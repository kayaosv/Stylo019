import { supabase } from '@/lib/supabase'

/**
 * Creates a Stripe Checkout Session via Supabase Edge Function
 * and returns the hosted checkout URL.
 *
 * @param {Array<{ nombre: string, talla: string, precioUnitario: number, cantidad: number }>} items
 * @returns {Promise<string>} Stripe Checkout URL
 * @throws {Error} if the session could not be created
 */
export const createCheckoutSession = async (items) => {
  const origin = window.location.origin

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      items,
      success_url: `${origin}/checkout/success`,
      cancel_url: `${origin}/checkout/cancel`,
    },
  })

  if (error) {
    // supabase-js wraps any non-2xx Edge Function response in a generic
    // FunctionsHttpError ("Edge Function returned a non-2xx status code")
    // — the real reason (stock insuficiente, producto ya no disponible,
    // etc.) is JSON in the raw response, only reachable via error.context.
    let message = error.message
    try {
      const body = await error.context?.json()
      if (body?.error) message = body.error
    } catch {
      // context wasn't JSON (network-level error) — keep the generic message
    }
    throw new Error(message)
  }
  if (!data?.url) throw new Error('No se pudo crear la sesión de pago')

  return data.url
}
