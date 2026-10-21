// Red pill next to "Pedidos" showing how many orders are waiting on `pendiente`
// (includes store reservations, which enter as pendiente).
export const PedidosBadge = ({ count }) => {
  if (!count) return null
  return (
    <span
      role="status"
      aria-label={`${count} ${count === 1 ? 'pedido pendiente' : 'pedidos pendientes'}`}
      className="font-sans"
      style={{
        marginLeft: '0.5rem',
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
