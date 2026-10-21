// Red pill next to "Pedidos" showing how many orders are waiting on `pendiente`
// (includes store reservations, which enter as pendiente). `flotante` pins it
// to the top-right corner of its (position: relative) parent like an app badge.
export const PedidosBadge = ({ count, flotante = false }) => {
  if (!count) return null
  return (
    <span
      role="status"
      aria-label={`${count} ${count === 1 ? 'pedido pendiente' : 'pedidos pendientes'}`}
      className="font-sans"
      style={{
        ...(flotante
          ? { position: 'absolute', top: '-0.5rem', right: '-0.5rem', pointerEvents: 'none', boxShadow: '0 0 0 2px var(--color-base)' }
          : { marginLeft: '0.5rem' }),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '1.15rem',
        height: '1.15rem',
        padding: '0 0.35rem',
        borderRadius: '9999px',
        background: '#ef4444',
        color: '#fff',
        fontSize: '0.68rem',
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
