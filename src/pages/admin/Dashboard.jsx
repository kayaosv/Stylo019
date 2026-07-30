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

const stockDe = (producto) =>
  Object.values(producto.tallas ?? {}).reduce((acc, v) => acc + (Number(v) || 0), 0)

const eur = (n) => `${Number(n ?? 0).toFixed(2)} €`

const formatDateShort = (iso) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })

const QuickLink = ({ to, label, hint, featured }) => (
  <Link
    to={to}
    className="quick-link-card flex flex-col justify-between transition-transform hover:-translate-y-0.5"
    style={{
      padding: '1.5rem',
      minHeight: '7.5rem',
      border: featured ? '1px solid var(--color-accent)' : '1px solid var(--color-surface)',
      backgroundColor: featured ? 'var(--color-accent)' : 'var(--color-paper)',
      gridColumn: featured ? '1 / -1' : undefined,
    }}
  >
    <span
      className="label-xs"
      style={{
        letterSpacing: '0.2em',
        color: featured ? 'rgba(255,255,255,0.85)' : 'var(--color-muted)',
      }}
    >
      {hint}
    </span>
    <span
      className="font-serif"
      style={{
        fontSize: featured ? '1.75rem' : '1.3rem',
        fontWeight: 300,
        letterSpacing: '-0.01em',
        color: featured ? '#fff' : 'var(--color-ink)',
      }}
    >
      {label}
    </span>
  </Link>
)

const StatCard = ({ label, value, warn }) => (
  <div
    className="flex flex-col bg-[var(--color-paper)]"
    style={{ padding: '1.25rem', border: '1px solid var(--color-surface)', gap: '0.4rem' }}
  >
    <span className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.2em' }}>
      {label}
    </span>
    <span
      className="font-serif"
      style={{
        fontSize: '2rem',
        fontWeight: 300,
        color: warn ? '#c0392b' : 'var(--color-ink)',
      }}
    >
      {value}
    </span>
  </div>
)

const SalesLineChart = ({ days }) => {
  const max = Math.max(1, ...days.map((d) => Math.max(d.tienda, d.web)))
  const n = days.length
  const toPoints = (getValue) =>
    days.map((d, i) => `${(i / (n - 1)) * 100},${100 - (getValue(d) / max) * 100}`).join(' ')
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '9rem' }}>
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
    return { activos: activos.length, stockTotal, valorInventario }
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
      gsap.from('.dash-header', { y: 20, opacity: 0, duration: 0.6, ease: 'power3.out' })
      gsap.from('.quick-link-card', {
        y: 20,
        opacity: 0,
        duration: 0.5,
        stagger: 0.06,
        delay: 0.15,
        ease: 'power3.out',
      })
      gsap.from('.dash-stat-card', {
        y: 20,
        opacity: 0,
        duration: 0.5,
        stagger: 0.06,
        delay: 0.35,
        ease: 'power3.out',
      })
    },
    { scope: ref, dependencies: [loadingProductos] },
  )

  const loading = loadingProductos && loadingPedidos
  const visibleLowStock = lowStockExpanded ? lowStock : lowStock.slice(0, LOW_STOCK_VISIBLE)
  const recientes = pedidos.slice(0, 8)

  if (loading) {
    return (
      <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.85rem' }}>
        Cargando…
      </p>
    )
  }

  return (
    <div ref={ref} className="flex flex-col" style={{ gap: '2rem' }}>
      <div className="dash-header">
        <span className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.25em' }}>
          Resumen
        </span>
        <h1
          className="font-serif text-[var(--color-ink)]"
          style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1, marginTop: '0.5rem' }}
        >
          Panel de control
        </h1>
      </div>

      {/* Accesos rápidos — Venta física primero y destacada */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: '1rem' }}>
        <QuickLink to="/admin/venta-fisica" hint="Mostrador" label="Venta física / TPV" featured />
        <QuickLink to="/admin/pedidos" hint="Ventas" label="Pedidos" />
        <QuickLink to="/admin/productos" hint="Catálogo" label="Productos" />
        <QuickLink to="/admin/productos/nuevo" hint="Catálogo" label="Nuevo producto" />
        <QuickLink to="/admin/categorias" hint="Catálogo" label="Categorías" />
        <QuickLink to="/admin/hero" hint="Web" label="Hero" />
        <QuickLink to="/admin/envios" hint="Web" label="Envíos" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 dash-stat-card" style={{ gap: '1rem' }}>
        <StatCard label="Productos activos" value={stats.activos} />
        <StatCard label="Stock total" value={`${stats.stockTotal} u.`} />
        <StatCard label="Valor inventario (aprox.)" value={eur(stats.valorInventario)} />
        <StatCard label="Stock bajo" value={lowStock.length} warn={lowStock.length > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: '1.5rem' }}>
        {/* Ventas 14 días */}
        <div className="bg-[var(--color-paper)]" style={{ padding: '1.5rem', border: '1px solid var(--color-surface)' }}>
          <h2 className="font-serif text-[var(--color-ink)]" style={{ fontSize: '1.15rem', fontWeight: 400, marginBottom: '1rem' }}>
            Ventas — últimos {HISTORY_DAYS} días
          </h2>
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
              <div className="flex justify-between font-sans text-[var(--color-muted-soft)]" style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>
                <span>{historial[0].label}</span>
                <span>{historial[historial.length - 1].label}</span>
              </div>
            </>
          )}
          <div className="flex" style={{ gap: '1.25rem', marginTop: '1rem' }}>
            <span className="flex items-center font-sans text-[var(--color-muted)]" style={{ gap: '0.4rem', fontSize: '0.75rem' }}>
              <i style={{ width: '0.6rem', height: '0.6rem', borderRadius: '9999px', background: 'var(--color-accent)', display: 'inline-block' }} />
              {CANAL_LABEL.tienda}
            </span>
            <span className="flex items-center font-sans text-[var(--color-muted)]" style={{ gap: '0.4rem', fontSize: '0.75rem' }}>
              <i style={{ width: '0.6rem', height: '0.6rem', borderRadius: '9999px', background: 'var(--color-accent-ink)', display: 'inline-block' }} />
              {CANAL_LABEL.web}
            </span>
          </div>
        </div>

        {/* Pedidos recientes */}
        <div className="bg-[var(--color-paper)]" style={{ padding: '1.5rem', border: '1px solid var(--color-surface)' }}>
          <h2 className="font-serif text-[var(--color-ink)]" style={{ fontSize: '1.15rem', fontWeight: 400, marginBottom: '1rem' }}>
            Pedidos recientes
          </h2>
          {recientes.length === 0 ? (
            <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.82rem' }}>
              Aún no hay pedidos.
            </p>
          ) : (
            <div className="flex flex-col" style={{ gap: '0.6rem' }}>
              {recientes.map((p) => (
                <Link
                  key={p.id}
                  to={`/admin/pedidos/${p.id}`}
                  className="flex items-center justify-between"
                  style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--color-surface)' }}
                >
                  <div className="flex flex-col">
                    <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.85rem' }}>
                      #{String(p.numero_ticket).padStart(6, '0')} · {p.cliente_nombre ?? 'Cliente no registrado'}
                    </span>
                    <span className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.72rem' }}>
                      {CANAL_LABEL[p.canal] ?? p.canal} · {ESTADO_META[p.estado]?.label ?? p.estado}
                    </span>
                  </div>
                  <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.85rem' }}>
                    {eur(p.total)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: '1.5rem' }}>
        {/* Productos por categoría */}
        <div className="bg-[var(--color-paper)]" style={{ padding: '1.5rem', border: '1px solid var(--color-surface)' }}>
          <h2 className="font-serif text-[var(--color-ink)]" style={{ fontSize: '1.15rem', fontWeight: 400, marginBottom: '1rem' }}>
            Productos por categoría
          </h2>
          <div className="flex flex-col" style={{ gap: '0.6rem' }}>
            {porCategoria.map((c) => (
              <div key={c.id} className="flex items-center" style={{ gap: '0.75rem' }}>
                <span className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.78rem', width: '7rem', flexShrink: 0 }}>
                  {c.nombre}
                </span>
                <div className="flex-1" style={{ height: '0.5rem', background: 'var(--color-base)' }}>
                  <div
                    style={{
                      width: `${(c.count / maxCategoria) * 100}%`,
                      height: '100%',
                      background: 'var(--color-accent)',
                    }}
                  />
                </div>
                <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.78rem', width: '1.5rem', textAlign: 'right' }}>
                  {c.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stock bajo */}
        <div className="bg-[var(--color-paper)]" style={{ padding: '1.5rem', border: '1px solid var(--color-surface)' }}>
          <h2 className="font-serif text-[var(--color-ink)]" style={{ fontSize: '1.15rem', fontWeight: 400, marginBottom: '1rem' }}>
            Stock bajo
          </h2>
          {lowStock.length === 0 ? (
            <p className="font-sans text-[var(--color-muted-soft)]" style={{ fontSize: '0.82rem' }}>
              Sin alertas de stock bajo.
            </p>
          ) : (
            <>
              <div className="flex flex-col" style={{ gap: '0.5rem' }}>
                {visibleLowStock.map((p) => {
                  const stock = stockDe(p)
                  return (
                    <Link
                      key={p.id}
                      to={`/admin/productos/${p.id}`}
                      className="flex items-center justify-between"
                      style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--color-surface)' }}
                    >
                      <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.82rem' }}>
                        {p.nombre}
                      </span>
                      <span
                        className="font-sans"
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.25rem 0.6rem',
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
                  className="font-sans text-[var(--color-accent-ink)]"
                  style={{ fontSize: '0.75rem', marginTop: '0.75rem' }}
                >
                  {lowStockExpanded ? 'Ver menos' : `Ver ${lowStock.length - LOW_STOCK_VISIBLE} más`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: '1.5rem' }}>
        {/* Pedidos por estado */}
        <div className="bg-[var(--color-paper)]" style={{ padding: '1.5rem', border: '1px solid var(--color-surface)' }}>
          <h2 className="font-serif text-[var(--color-ink)]" style={{ fontSize: '1.15rem', fontWeight: 400, marginBottom: '1rem' }}>
            Pedidos por estado
          </h2>
          <div className="flex flex-col" style={{ gap: '0.5rem' }}>
            {VENTA_ESTADOS.map((s) => (
              <div key={s} className="flex items-center justify-between">
                <span className="flex items-center font-sans text-[var(--color-muted)]" style={{ gap: '0.4rem', fontSize: '0.78rem' }}>
                  <i style={{ width: '0.55rem', height: '0.55rem', borderRadius: '9999px', background: ESTADO_META[s].color, display: 'inline-block' }} />
                  {ESTADO_META[s].label}
                </span>
                <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.78rem' }}>
                  {porEstado[s]} ({pct(porEstado[s], pedidos.length)})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Métodos de pago */}
        <div className="bg-[var(--color-paper)]" style={{ padding: '1.5rem', border: '1px solid var(--color-surface)' }}>
          <h2 className="font-serif text-[var(--color-ink)]" style={{ fontSize: '1.15rem', fontWeight: 400, marginBottom: '1rem' }}>
            Métodos de pago (tienda)
          </h2>
          <div className="flex flex-col" style={{ gap: '0.5rem' }}>
            <div className="flex items-center justify-between">
              <span className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.78rem' }}>Efectivo</span>
              <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.78rem' }}>
                {porMetodoPago.efectivo} ({pct(porMetodoPago.efectivo, totalMetodoPago)})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.78rem' }}>Tarjeta</span>
              <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.78rem' }}>
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
