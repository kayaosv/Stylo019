import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchPedidoById, updatePedidoEstado, ESTADO_META, VENTA_ESTADOS } from '@/hooks/useAdminPedidos'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { marcarPedidoCobrado } from '@/services/pedidos'
import {
  enlaceWhatsApp,
  esReserva,
  etiquetaCanal,
  mensajeCancelacion,
  pendienteDeCobro,
  venceEl,
} from '@/lib/pedidos'

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

const PedidoDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pedido, setPedido] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState(null)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cobroMetodo, setCobroMetodo] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchPedidoById(id)
      if (!data) {
        setError('Pedido no encontrado.')
      } else {
        setPedido(data)
        setError(null)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const aplicarCambioEstado = async (next) => {
    const prevEstado = pedido.estado
    setUpdating(true)
    setPedido((p) => ({ ...p, estado: next }))
    try {
      await updatePedidoEstado(id, next)
      await load()
    } catch (err) {
      setPedido((p) => ({ ...p, estado: prevEstado }))
      alert(`No se pudo actualizar: ${err.message}`)
    } finally {
      setUpdating(false)
    }
  }

  const cambiarEstado = (next) => {
    if (next === 'cancelado') {
      setCancelConfirm(true)
      return
    }
    aplicarCambioEstado(next)
  }

  const confirmarCancelacion = async () => {
    setCancelConfirm(false)
    await aplicarCambioEstado('cancelado')
  }

  const confirmarCobro = async () => {
    const metodo = cobroMetodo
    setCobroMetodo(null)
    setUpdating(true)
    try {
      await marcarPedidoCobrado(id, metodo)
      await load()
    } catch (err) {
      alert(`No se pudo marcar como cobrado: ${err.message}`)
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.85rem' }}>Cargando pedido…</p>
  }
  if (error || !pedido) {
    return <p className="font-sans" style={{ fontSize: '0.85rem', color: '#c0392b' }}>{error ?? 'Pedido no encontrado.'}</p>
  }

  return (
    <div className="flex flex-col" style={{ gap: '2rem', maxWidth: '48rem' }}>
      <div>
        <Link
          to="/admin/pedidos"
          className="label-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          style={{ letterSpacing: '0.25em' }}
        >
          ← Volver a pedidos
        </Link>
        <div className="flex flex-wrap items-center justify-between" style={{ gap: '1rem', marginTop: '0.65rem' }}>
          <h1
            className="font-serif text-[var(--color-ink)]"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1 }}
          >
            Ticket #{String(pedido.numero_ticket).padStart(6, '0')}
          </h1>
          <select
            value={pedido.estado}
            disabled={updating}
            onChange={(e) => cambiarEstado(e.target.value)}
            className="bg-[var(--color-paper)] font-sans text-[var(--color-ink)] outline-none"
            style={{ border: '1px solid var(--color-surface)', padding: '0.65rem 0.85rem', fontSize: '0.85rem' }}
          >
            {VENTA_ESTADOS.map((s) => (
              <option key={s} value={s}>{ESTADO_META[s].label}</option>
            ))}
          </select>
        </div>
        <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
          {etiquetaCanal(pedido)}
          {' · '}{formatDate(pedido.created_at)}
        </p>
      </div>

      {pendienteDeCobro(pedido) && (
        <section style={{ border: '1px solid #f59e0b', background: '#fffbeb', padding: '1.5rem' }}>
          <p className="label-xs" style={{ letterSpacing: '0.22em', color: '#b45309', marginBottom: '0.5rem' }}>Pendiente de cobro</p>
          <p className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
            Recogida y pago en tienda. Stock reservado hasta el {venceEl(pedido).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}.
          </p>
          <div className="flex flex-wrap" style={{ gap: '0.6rem', marginTop: '1rem' }}>
            {['efectivo', 'tarjeta'].map((metodo) => (
              <button
                key={metodo}
                type="button"
                disabled={updating}
                onClick={() => setCobroMetodo(metodo)}
                className="font-sans text-[var(--color-ink)]"
                style={{ border: '1px solid var(--color-ink)', padding: '0.6rem 1rem', fontSize: '0.8rem' }}
              >
                Cobrado en {metodo}
              </button>
            ))}
          </div>
        </section>
      )}

      {esReserva(pedido) && pedido.pagado_at && (
        <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.8rem' }}>
          Cobrado el {formatDate(pedido.pagado_at)}{pedido.cobrado_con ? ` en ${pedido.cobrado_con}` : ''}.
        </p>
      )}

      {pedido.canal === 'web' && (
        <section className="bg-[var(--color-paper)]" style={{ border: '1px solid var(--color-surface)', padding: '1.5rem' }}>
          <p className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.22em', marginBottom: '0.75rem' }}>Cliente</p>
          <p className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>
            {pedido.cliente_nombre ?? '—'}<br />
            {pedido.cliente_email && <a href={`mailto:${pedido.cliente_email}`} style={{ color: 'var(--color-accent-ink)' }}>{pedido.cliente_email}</a>}
            {pedido.cliente_telefono && (
              <>
                <br />
                {pedido.cliente_telefono}{' · '}
                <a href={enlaceWhatsApp(pedido.cliente_telefono)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-ink)' }}>
                  Escribir por WhatsApp
                </a>
              </>
            )}
            {pedido.cliente_direccion && <><br />{pedido.cliente_direccion}</>}
          </p>
        </section>
      )}

      <section className="bg-[var(--color-paper)]" style={{ border: '1px solid var(--color-surface)', padding: '1.5rem' }}>
        <p className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.22em', marginBottom: '1rem' }}>Líneas</p>
        <div className="flex flex-col" style={{ gap: '0.75rem' }}>
          {pedido.venta_items.map((it) => (
            <div key={it.id} className="flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-surface)', paddingBottom: '0.75rem' }}>
              <div>
                <p className="font-serif text-[var(--color-ink)]" style={{ fontSize: '0.95rem' }}>{it.producto_nombre}</p>
                <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.75rem' }}>
                  {[it.color_label, `Talla ${it.talla}`].filter(Boolean).join(' — ')} · {it.cantidad} ×{' '}
                  {it.precio_original != null && (
                    <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{Number(it.precio_original).toFixed(2)} € </span>
                  )}
                  {Number(it.precio_unitario).toFixed(2)} €
                </p>
              </div>
              <span className="font-serif">{(it.cantidad * Number(it.precio_unitario)).toFixed(2)} €</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between font-serif" style={{ fontSize: '1.3rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-surface)' }}>
          <span>Total</span>
          <span>{Number(pedido.total).toFixed(2)} €</span>
        </div>
      </section>

      {pedido.canal === 'web' && !pendienteDeCobro(pedido) && (
        <section className="bg-[var(--color-paper)]" style={{ border: '1px solid var(--color-surface)', padding: '1.5rem' }}>
          <p className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.22em', marginBottom: '0.5rem' }}>Factura Odoo</p>
          <p className="font-sans" style={{ fontSize: '0.85rem' }}>
            {pedido.odoo_sync_status === 'synced' && <span style={{ color: '#16a34a' }}>✓ Sincronizada (factura #{pedido.odoo_invoice_id})</span>}
            {pedido.odoo_sync_status === 'error' && <span style={{ color: '#c0392b' }}>⚠ {pedido.odoo_sync_error ?? 'Falló la sincronización'}</span>}
            {(!pedido.odoo_sync_status || pedido.odoo_sync_status === 'pending') && <span className="text-[var(--color-muted)]">Pendiente</span>}
          </p>
        </section>
      )}

      {pedido.notas && (
        <section className="bg-[var(--color-paper)]" style={{ border: '1px solid var(--color-surface)', padding: '1.5rem' }}>
          <p className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.22em', marginBottom: '0.5rem' }}>Notas</p>
          <p className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.85rem' }}>{pedido.notas}</p>
        </section>
      )}

      <ConfirmDialog
        open={cancelConfirm}
        title="Cancelar venta"
        message={mensajeCancelacion(pedido)}
        confirmLabel="Cancelar venta"
        loadingLabel="Cancelando…"
        cancelLabel="Volver"
        loading={updating}
        onConfirm={confirmarCancelacion}
        onCancel={() => setCancelConfirm(false)}
      />

      <ConfirmDialog
        open={cobroMetodo !== null}
        title="Marcar como cobrado"
        message={`¿Confirmas que has cobrado ${Number(pedido.total).toFixed(2)} € en ${cobroMetodo ?? ''}? Esta acción no se puede deshacer desde aquí.`}
        confirmLabel="Sí, cobrado"
        loadingLabel="Guardando…"
        cancelLabel="Volver"
        loading={updating}
        onConfirm={confirmarCobro}
        onCancel={() => setCobroMetodo(null)}
      />
    </div>
  )
}

export default PedidoDetail
