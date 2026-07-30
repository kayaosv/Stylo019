import { useEffect, useRef, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { fetchProductosAdmin } from '@/services/productos'
import { fetchCategorias } from '@/services/categorias'
import { useAdminPedidos, ESTADO_META, VENTA_ESTADOS } from '@/hooks/useAdminPedidos'

const CANAL_LABEL = { web: 'Web · Stripe', tienda: 'Tienda física' }
const LOW_STOCK_THRESHOLD = 5
const HISTORY_DAYS = 14
const LOW_STOCK_VISIBLE = 5
const SCROLL_MAX_HEIGHT = '15rem'

const stockDe = (producto) =>
  Object.values(producto.tallas ?? {}).reduce((acc, v) => acc + (Number(v) || 0), 0)

const eur = (n) => `${Number(n ?? 0).toFixed(2)} €`

const formatDateShort = (iso) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })

// Botón de acción de header — mismo lenguaje visual que los filtros de
// Pedidos.jsx (rectángulo plano, borde, texto uppercase tracked, hover
// rellena de sólido) en vez de inventar una píldora redondeada nueva.
const HeaderAction = ({ to, label, primary }) => (
  <Link
    to={to}
    className="font-sans transition-colors"
    style={{
      fontSize: '0.72rem',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      padding: '0.65rem 1.1rem',
      whiteSpace: 'nowrap',
      border: primary ? '1px solid var(--color-accent)' : '1px solid var(--color-surface)',
      backgroundColor: primary ? 'var(--color-accent)' : 'transparent',
      color: primary ? '#fff' : 'var(--color-muted)',
    }}
  >
    {label}
  </Link>
)

const StatCard = ({ label, value, warn }) => (
  <div
    className="flex flex-col bg-[var(--color-paper)]"
    style={{ padding: '0.9rem 1.1rem', border: '1px solid var(--color-surface)', gap: '0.3rem' }}
  >
    <span className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.18em' }}>
      {label}
    </span>
    <span
      className="font-serif"
      style={{ fontSize: '1.5rem', fontWeight: 300, color: warn ? '#c0392b' : 'var(--color-ink)' }}
    >
      {value}
    </span>
  </div>
)

// Grafico de lineas con eje Y real (gridlines + valores) — a diferencia
// del de Alcosa, que solo tiene fecha inicial/final sin ninguna
// referencia de escala.
const SalesLineChart = ({ days }) => {
  const max = Math.max(1, ...days.map((d) => Math.max(d.tienda, d.web)))
  const n = days.length
  const yTicks = [max, Math.round(max / 2), 0]
  const toPoints = (getValue) =>
    days.map((d, i) => `${(i / (n - 1)) * 100},${100 - (getValue(d) / max) * 100}`).join(' ')

  return (
    <div className="flex" style={{ gap: '0.6rem' }}>
      <div className="flex flex-col justify-between font-sans text-[var(--color-muted-soft)]" style={{ fontSize: '0.65rem', height: '9rem', textAlign: 'right' }}>
        {yTicks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="flex-1" style={{ position: 'relative' }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '9rem', display: 'block' }}>
          {[0, 50, 100].map((y) => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--color-surface)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          ))}
          <polyline
            points={toPoints((d) => d.tienda)}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={toPoints((d) => d.web)}
            fill="none"
            stroke="var(--color-accent-ink)"
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  )
}

const Dashboard = () => {
  const ref = useRef(null)
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loadingProductos, setLoadingProductos] = useState(true)
  const { pedidos, loading: loadingPedidos } = useAdminPedidos()
  const [lowStockExpanded, setLowStockExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchProductosAdmin({}), fetchCategorias()]).then(([prod, cat]) => {
      if (cancelled) return
      setProductos(prod.data ?? [])
      setCategorias(cat.data ?? [])
      setLoadingProductos(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const activos = productos.filter((p) => p.activo)
    const stockTotal = activos.reduce((acc, p) => acc + stockDe(p), 0)
    const valorInventario = activos.reduce(
      (acc, p) => acc + Number(p.precio_oferta ?? p.precio ?? 0) * stockDe(p),
      0,
    )
    const sinStock = activos.filter((p) => stockDe(p) === 0).length
    return { activos: activos.length, stockTotal, valorInventario, sinStock }
  }, [productos])

  const lowStock = useMemo(
    () =>
      productos
        .filter((p) => p.activo && stockDe(p) < LOW_STOCK_THRESHOLD)
        .sort((a, b) => stockDe(a) - stockDe(b)),
    [productos],
  )

  const porCategoria = useMemo(
    () =>
      categorias
        .map((c) => ({
          ...c,
          count: productos.filter((p) => p.activo && p.categoria === c.id).length,
        }))
        .sort((a, b) => b.count - a.count),
    [categorias, productos],
  )
  const maxCategoria = Math.max(1, ...porCategoria.map((c) => c.count))

  const ventasSinCancelar = useMemo(
    () => pedidos.filter((p) => p.estado !== 'cancelado'),
    [pedidos],
  )

  const historial = useMemo(() => {
    const days = []
    const now = new Date()
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days.push({ date: d.toISOString().slice(0, 10), label: formatDateShort(d), tienda: 0, web: 0 })
    }
    const byDate = Object.fromEntries(days.map((d) => [d.date, d]))
    ventasSinCancelar.forEach((v) => {
      const bucket = byDate[(v.created_at ?? '').slice(0, 10)]
      if (!bucket) return
      bucket[v.canal === 'web' ? 'web' : 'tienda'] += 1
    })
    return days
  }, [ventasSinCancelar])

  const puntosConDatos = historial.filter((d) => d.tienda + d.web > 0)
  const totalVentanaHistorial = puntosConDatos.length

  const porEstado = useMemo(() => {
    const map = Object.fromEntries(VENTA_ESTADOS.map((s) => [s, 0]))
    pedidos.forEach((p) => {
      map[p.estado] = (map[p.estado] || 0) + 1
    })
    return map
  }, [pedidos])

  const porMetodoPago = useMemo(() => {
    const map = { efectivo: 0, tarjeta: 0 }
    ventasSinCancelar.forEach((p) => {
      if (p.metodo_pago in map) map[p.metodo_pago] += 1
    })
    return map
  }, [ventasSinCancelar])
  const totalMetodoPago = porMetodoPago.efectivo + porMetodoPago.tarjeta

  const pct = (n, total) => (total === 0 ? '0%' : `${Math.round((n / total) * 100)}%`)

  // Animación de entrada — mismo patrón que Login.jsx. Bloque aislado,
  // fácil de quitar si diera problemas (aquí no aplica el motivo por el
  // que se descartó GSAP en el CartDrawer: esto monta una vez por
  // navegación, no se togglea constantemente).
  useGSAP(
    () => {
      if (loadingProductos) return
      gsap.from('.dash-header', { y: 16, opacity: 0, duration: 0.5, ease: 'power3.out' })
      gsap.from('.dash-section', { y: 16, opacity: 0, duration: 0.5, stagger: 0.07, delay: 0.15, ease: 'power3.out' })
    },
    { scope: ref, dependencies: [loadingProductos] },
  )

  const loading = loadingProductos && loadingPedidos
  const visibleLowStock = lowStockExpanded ? lowStock : lowStock.slice(0, LOW_STOCK_VISIBLE)
  const recientes = pedidos.slice(0, 12)

  if (loading) {
    return (
      <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.85rem' }}>
        Cargando…
      </p>
    )
  }

  const sectionStyle = {
    padding: '1.5rem',
    border: '1px solid var(--color-surface)',
    backgroundColor: 'var(--color-paper)',
  }
  const sectionTitleStyle = {
    fontSize: '0.72rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--color-muted)',
    marginBottom: '1.1rem',
  }
  const scrollBoxStyle = { maxHeight: SCROLL_MAX_HEIGHT, overflowY: 'auto', paddingRight: '0.4rem' }

  return (
    <div ref={ref} className="flex flex-col" style={{ gap: '1.5rem' }}>
      {/* Header + acciones rápidas (botones compactos, no tarjetas) */}
      <div className="dash-header flex flex-wrap items-start justify-between" style={{ gap: '1rem' }}>
        <div>
          <span className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.25em' }}>
            Resumen
          </span>
          <h1
            className="font-serif text-[var(--color-ink)]"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1, marginTop: '0.5rem' }}
          >
            Panel de control
          </h1>
        </div>
        <div className="flex flex-wrap items-center" style={{ gap: '0.6rem' }}>
          <HeaderAction to="/admin/pedidos" label="Pedidos" />
          <HeaderAction to="/admin/venta-fisica" label="Venta física / TPV" primary />
          <HeaderAction to="/admin/productos/nuevo" label="+ Nuevo producto" />
        </div>
      </div>

      {/* Fila 1: grafico de ventas + historial de pedidos */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] dash-section" style={{ gap: '1.25rem' }}>
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Ventas — física vs web (últimos {HISTORY_DAYS} días)</h2>
          {totalVentanaHistorial === 0 ? (
            <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.82rem' }}>
              Aún no hay ventas registradas en los últimos {HISTORY_DAYS} días.
            </p>
          ) : totalVentanaHistorial === 1 ? (
            <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.82rem' }}>
              Solo hay un día con ventas por ahora ({puntosConDatos[0].label}: {puntosConDatos[0].tienda + puntosConDatos[0].web} pedido/s).
              El gráfico se completará con más datos.
            </p>
          ) : (
            <>
              <SalesLineChart days={historial} />
              <div className="flex justify-between font-sans text-[var(--color-muted-soft)]" style={{ fontSize: '0.68rem', marginTop: '0.4rem', marginLeft: '2rem' }}>
                <span>{historial[0].label}</span>
                <span>{historial[historial.length - 1].label}</span>
              </div>
            </>
          )}
          <div className="flex" style={{ gap: '1.25rem', marginTop: '1rem' }}>
            <span className="flex items-center font-sans text-[var(--color-muted)]" style={{ gap: '0.4rem', fontSize: '0.72rem' }}>
              <i style={{ width: '0.55rem', height: '0.55rem', borderRadius: '9999px', background: 'var(--color-accent)', display: 'inline-block' }} />
              {CANAL_LABEL.tienda}
            </span>
            <span className="flex items-center font-sans text-[var(--color-muted)]" style={{ gap: '0.4rem', fontSize: '0.72rem' }}>
              <i style={{ width: '0.55rem', height: '0.55rem', borderRadius: '9999px', background: 'var(--color-accent-ink)', display: 'inline-block' }} />
              {CANAL_LABEL.web}
            </span>
          </div>
        </div>

        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Historial de pedidos</h2>
          {recientes.length === 0 ? (
            <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.82rem' }}>
              Aún no hay pedidos.
            </p>
          ) : (
            <div className="flex flex-col" style={{ ...scrollBoxStyle, gap: '0.5rem' }}>
              {recientes.map((p) => (
                <Link
                  key={p.id}
                  to={`/admin/pedidos/${p.id}`}
                  className="flex items-center justify-between"
                  style={{ padding: '0.55rem 0', borderBottom: '1px solid var(--color-surface)' }}
                >
                  <div className="flex flex-col">
                    <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.8rem' }}>
                      #{String(p.numero_ticket).padStart(6, '0')} · {p.cliente_nombre ?? 'Cliente no registrado'}
                    </span>
                    <span className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.68rem' }}>
                      {formatDateShort(p.created_at)} · {CANAL_LABEL[p.canal] ?? p.canal}
                    </span>
                  </div>
                  <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.8rem' }}>
                    {eur(p.total)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fila 2: totales compactos */}
      <div className="grid grid-cols-2 md:grid-cols-4 dash-section" style={{ gap: '0.9rem' }}>
        <StatCard label="Productos activos" value={stats.activos} />
        <StatCard label="Valor inventario" value={eur(stats.valorInventario)} />
        <StatCard label="Sin stock" value={stats.sinStock} warn={stats.sinStock > 0} />
        <StatCard label="Stock bajo" value={lowStock.length} warn={lowStock.length > 0} />
      </div>

      {/* Fila 3: por categoria + stock bajo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 dash-section" style={{ gap: '1.25rem' }}>
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Por categoría (cantidad)</h2>
          <div className="flex flex-col" style={{ ...scrollBoxStyle, gap: '0.65rem' }}>
            {porCategoria.map((c) => (
              <div key={c.id} className="flex items-center" style={{ gap: '0.75rem' }}>
                <span className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.75rem', width: '7rem', flexShrink: 0 }}>
                  {c.nombre}
                </span>
                <div className="flex-1" style={{ height: '0.4rem', background: 'var(--color-base)' }}>
                  <div style={{ width: `${(c.count / maxCategoria) * 100}%`, height: '100%', background: 'var(--color-accent)' }} />
                </div>
                <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.75rem', width: '1.5rem', textAlign: 'right' }}>
                  {c.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Stock bajo</h2>
          {lowStock.length === 0 ? (
            <p className="font-sans text-[var(--color-muted-soft)]" style={{ fontSize: '0.82rem' }}>
              Sin alertas de stock bajo.
            </p>
          ) : (
            <>
              <div className="flex flex-col" style={{ ...scrollBoxStyle, gap: '0.5rem', maxHeight: lowStockExpanded ? '28rem' : SCROLL_MAX_HEIGHT }}>
                {visibleLowStock.map((p) => {
                  const stock = stockDe(p)
                  return (
                    <Link
                      key={p.id}
                      to={`/admin/productos/${p.id}`}
                      className="flex items-center justify-between"
                      style={{ padding: '0.5rem 0.6rem', border: '1px solid var(--color-surface)' }}
                    >
                      <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.78rem' }}>
                        {p.nombre}
                      </span>
                      <span
                        className="font-sans"
                        style={{
                          fontSize: '0.68rem',
                          padding: '0.2rem 0.55rem',
                          color: stock === 0 ? '#c0392b' : '#b7791f',
                          background: stock === 0 ? '#fdecea' : '#fdf3dc',
                        }}
                      >
                        {stock === 0 ? 'AGOTADO' : `${stock} u.`}
                      </span>
                    </Link>
                  )
                })}
              </div>
              {lowStock.length > LOW_STOCK_VISIBLE && (
                <button
                  type="button"
                  onClick={() => setLowStockExpanded((v) => !v)}
                  className="font-sans text-[var(--color-accent-ink)] w-full"
                  style={{ fontSize: '0.72rem', marginTop: '0.6rem' }}
                >
                  {lowStockExpanded ? 'Ver menos' : `Ver ${lowStock.length - LOW_STOCK_VISIBLE} más`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Fila 4: pedidos por estado + metodos de pago */}
      <div className="grid grid-cols-1 lg:grid-cols-2 dash-section" style={{ gap: '1.25rem' }}>
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Pedidos por estado</h2>
          <div className="flex flex-col" style={{ gap: '0.55rem' }}>
            {VENTA_ESTADOS.map((s) => (
              <div key={s} className="flex items-center justify-between">
                <span className="flex items-center font-sans text-[var(--color-muted)]" style={{ gap: '0.4rem', fontSize: '0.76rem' }}>
                  <i style={{ width: '0.5rem', height: '0.5rem', borderRadius: '9999px', background: ESTADO_META[s].color, display: 'inline-block' }} />
                  {ESTADO_META[s].label}
                </span>
                <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.76rem' }}>
                  {porEstado[s]} ({pct(porEstado[s], pedidos.length)})
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Métodos de pago (tienda)</h2>
          <div className="flex flex-col" style={{ gap: '0.55rem' }}>
            <div className="flex items-center justify-between">
              <span className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.76rem' }}>Efectivo</span>
              <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.76rem' }}>
                {porMetodoPago.efectivo} ({pct(porMetodoPago.efectivo, totalMetodoPago)})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.76rem' }}>Tarjeta</span>
              <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.76rem' }}>
                {porMetodoPago.tarjeta} ({pct(porMetodoPago.tarjeta, totalMetodoPago)})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
