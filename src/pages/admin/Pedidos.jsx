import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAdminPedidos, updatePedidoEstado, ESTADO_META, VENTA_ESTADOS } from '@/hooks/useAdminPedidos'

const CANAL_LABEL = { web: 'Web · Stripe', tienda: 'Tienda física' }

const CanalBadge = ({ canal, metodoPago }) => {
  const label = canal === 'tienda'
    ? `Mostrador · ${metodoPago === 'tarjeta' ? 'Tarjeta' : 'Efectivo'}`
    : CANAL_LABEL[canal] ?? canal
  return (
    <span
      className="font-sans"
      style={{
        fontSize: '0.68rem', letterSpacing: '0.05em', padding: '0.3rem 0.6rem',
        border: '1px solid var(--color-surface)', color: 'var(--color-muted)', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

const OdooBadge = ({ status }) => {
  if (!status || status === 'pending') return null
  const ok = status === 'synced'
  return (
    <span
      title={ok ? 'Factura creada en Odoo' : 'Falló la sincronización con Odoo'}
      className="font-sans"
      style={{ fontSize: '0.68rem', marginLeft: '0.4rem', color: ok ? '#16a34a' : '#c0392b' }}
    >
      {ok ? '✓ Odoo' : '⚠ Odoo'}
    </span>
  )
}

const EstadoSelect = ({ estado, disabled, onChange }) => (
  <select
    value={estado}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
    className="bg-[var(--color-paper)] font-sans text-[var(--color-ink)] outline-none"
    style={{ border: '1px solid var(--color-surface)', padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}
  >
    {VENTA_ESTADOS.map((s) => (
      <option key={s} value={s}>{ESTADO_META[s].label}</option>
    ))}
  </select>
)

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

const Pedidos = () => {
  const { pedidos, loading, setPedidos } = useAdminPedidos()
  const [filtro, setFiltro] = useState('all')
  const [busqueda, setBusqueda] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  const cambiarEstado = async (pedido, next) => {
    if (next === 'cancelado' && !confirm('¿Cancelar este pedido? Se repondrá el stock.')) return
    setUpdatingId(pedido.id)
    const prev = pedidos
    setPedidos((ps) => ps.map((p) => (p.id === pedido.id ? { ...p, estado: next } : p)))
    try {
      await updatePedidoEstado(pedido.id, next)
    } catch (err) {
      setPedidos(prev)
      alert(`No se pudo actualizar el pedido: ${err.message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  const counts = useMemo(() => {
    const c = { all: pedidos.length }
    VENTA_ESTADOS.forEach((s) => { c[s] = 0 })
    pedidos.forEach((p) => { c[p.estado] = (c[p.estado] || 0) + 1 })
    return c
  }, [pedidos])

  const filtrados = useMemo(() => {
    let list = pedidos
    if (filtro !== 'all') list = list.filter((p) => p.estado === filtro)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      list = list.filter((p) =>
        p.cliente_nombre?.toLowerCase().includes(q) ||
        p.cliente_email?.toLowerCase().includes(q) ||
        String(p.numero_ticket).includes(q)
      )
    }
    return list
  }, [pedidos, filtro, busqueda])

  return (
    <div className="flex flex-col" style={{ gap: '2rem' }}>
      <div>
        <span className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.25em' }}>Ventas</span>
        <h1
          className="font-serif text-[var(--color-ink)]"
          style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1, marginTop: '0.5rem' }}
        >
          Pedidos
        </h1>
        <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
          Web (Stripe) y tienda física, en un mismo lugar.
        </p>
      </div>

      <div className="flex flex-wrap items-center" style={{ gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setFiltro('all')}
          className="font-sans"
          style={{
            fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.55rem 0.9rem',
            border: filtro === 'all' ? '1px solid var(--color-accent)' : '1px solid var(--color-surface)',
            backgroundColor: filtro === 'all' ? 'var(--color-accent)' : 'transparent',
            color: filtro === 'all' ? 'var(--color-paper)' : 'var(--color-muted)',
          }}
        >
          Todos ({counts.all})
        </button>
        {VENTA_ESTADOS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFiltro(s)}
            className="flex items-center font-sans"
            style={{
              gap: '0.4rem', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.55rem 0.9rem',
              border: filtro === s ? '1px solid var(--color-accent)' : '1px solid var(--color-surface)',
              backgroundColor: filtro === s ? 'var(--color-accent)' : 'transparent',
              color: filtro === s ? 'var(--color-paper)' : 'var(--color-muted)',
            }}
          >
            <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '9999px', background: ESTADO_META[s].color, display: 'inline-block' }} />
            {ESTADO_META[s].label} ({counts[s] || 0})
          </button>
        ))}
      </div>

      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por cliente, email o nº de ticket…"
        className="bg-[var(--color-paper)] font-sans text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
        style={{ border: '1px solid var(--color-surface)', padding: '0.85rem 1rem', fontSize: '0.9rem', maxWidth: '24rem' }}
      />

      {loading ? (
        <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.85rem' }}>Cargando pedidos…</p>
      ) : filtrados.length === 0 ? (
        <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.85rem' }}>No hay pedidos en este filtro.</p>
      ) : (
        <div className="bg-[var(--color-paper)]" style={{ border: '1px solid var(--color-surface)', overflowX: 'auto' }}>
          <table className="w-full font-sans" style={{ fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-surface)', textAlign: 'left' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Ticket</th>
                <th style={{ padding: '0.85rem 1rem' }}>Cliente</th>
                <th style={{ padding: '0.85rem 1rem' }}>Canal</th>
                <th style={{ padding: '0.85rem 1rem' }}>Total</th>
                <th style={{ padding: '0.85rem 1rem' }}>Estado</th>
                <th style={{ padding: '0.85rem 1rem' }}>Fecha</th>
                <th style={{ padding: '0.85rem 1rem' }} />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--color-surface)' }}>
                  <td style={{ padding: '0.85rem 1rem' }}>#{String(p.numero_ticket).padStart(6, '0')}</td>
                  <td style={{ padding: '0.85rem 1rem' }}>{p.cliente_nombre ?? '—'}</td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <CanalBadge canal={p.canal} metodoPago={p.metodo_pago} />
                    {p.canal === 'tienda' && <OdooBadge status={p.odoo_sync_status} />}
                    {p.canal === 'web' && <OdooBadge status={p.odoo_sync_status} />}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>{Number(p.total).toFixed(2)} €</td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <EstadoSelect estado={p.estado} disabled={updatingId === p.id} onChange={(next) => cambiarEstado(p, next)} />
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{formatDate(p.created_at)}</td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <Link to={`/admin/pedidos/${p.id}`} className="text-[var(--color-accent-ink)]">Abrir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Pedidos
