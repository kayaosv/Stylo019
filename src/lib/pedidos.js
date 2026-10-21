// Admin rules for orders. A "reserva" is a web order paid in the store
// (metodo_pago = 'recogida'); it counts as a sale only once pagado_at is set.

const DIAS_RESERVA = 7 // must match expirar_ventas_pendientes()

export const esReserva = (pedido) => pedido.metodo_pago === 'recogida'

export const pendienteDeCobro = (pedido) =>
  esReserva(pedido) && !pedido.pagado_at && pedido.estado !== 'cancelado'

export const esVentaCobrada = (pedido) => pedido.estado !== 'cancelado' && Boolean(pedido.pagado_at)

export const resumenPorCobrar = (pedidos) =>
  pedidos.filter(pendienteDeCobro).reduce(
    (acc, p) => ({ cantidad: acc.cantidad + 1, importe: acc.importe + Number(p.total) }),
    { cantidad: 0, importe: 0 },
  )

export const etiquetaCanal = (pedido) => {
  if (pedido.canal === 'tienda') return `Mostrador · ${pedido.metodo_pago === 'tarjeta' ? 'Tarjeta' : 'Efectivo'}`
  if (esReserva(pedido)) {
    return pedido.cobrado_con
      ? `Web · Recogida en tienda (cobrado en ${pedido.cobrado_con})`
      : 'Web · Recogida en tienda'
  }
  return 'Web · Stripe'
}

// cancelar_venta() restores stock but never touches money.
export const mensajeCancelacion = (pedido) => {
  if (pedido.canal === 'tienda') {
    return `Esta venta ya se cobró en el mostrador (${pedido.metodo_pago === 'tarjeta' ? 'tarjeta' : 'efectivo'}). Cancelarla repone el stock de cada línea, pero NO devuelve el dinero automáticamente — si corresponde reembolso, hay que gestionarlo aparte.`
  }
  if (esReserva(pedido)) {
    return pedido.pagado_at
      ? `Esta reserva ya se cobró en tienda (${pedido.cobrado_con ?? 'efectivo o tarjeta'}). Cancelarla repone el stock de cada línea, pero NO devuelve el dinero automáticamente — si corresponde reembolso, hay que gestionarlo aparte.`
      : 'Esta reserva todavía no se ha cobrado, así que no hay dinero que devolver. Cancelarla repone el stock de cada línea.'
  }
  return 'Esta venta se pagó por Stripe. Cancelarla repone el stock de cada línea, pero no reembolsa el pago automáticamente — si corresponde, gestiona el reembolso desde el dashboard de Stripe.'
}

export const enlaceWhatsApp = (telefono) => `https://wa.me/${String(telefono ?? '').replace(/\D/g, '')}`

export const venceEl = (pedido) => new Date(new Date(pedido.created_at).getTime() + DIAS_RESERVA * 86_400_000)
