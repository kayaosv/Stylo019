import { supabase } from '@/lib/supabase'

const MENSAJE_GENERICO = 'No se pudo crear la reserva. Inténtalo de nuevo o escríbenos por WhatsApp.'

/**
 * Creates a "recogida y pago en tienda" reservation through the
 * crear-pedido-recogida edge function. Prices and stock are always resolved on
 * the server; the browser only sends what the customer chose.
 *
 * @returns {Promise<object>} the saved reservation (numero_ticket, total, lineas, expira_el…)
 * @throws {Error} with a message that is safe to show to the customer
 */
export const crearPedidoRecogida = async (payload) => {
  const { data, error } = await supabase.functions.invoke('crear-pedido-recogida', { body: payload })

  if (error) {
    // supabase-js hides the real reason of a non-2xx response behind a generic
    // message; it is only available as JSON in error.context.
    let message = MENSAJE_GENERICO
    try {
      const body = await error.context?.json()
      if (body?.error) message = body.error
    } catch {
      // not JSON (network-level failure): keep the friendly default
    }
    throw new Error(message)
  }
  if (!data?.numero_ticket) throw new Error(MENSAJE_GENERICO)

  return data
}

// Admin only (RLS + auth check inside the function).
export const marcarPedidoCobrado = async (ventaId, metodo) => {
  const { error } = await supabase.rpc('marcar_pedido_cobrado', { p_venta_id: ventaId, p_metodo: metodo })
  if (error) throw new Error(error.message)
}
