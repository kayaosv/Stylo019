import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@13.3.0?target=deno&no-check"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { items, success_url, cancel_url } = await req.json()

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "Carrito vacío" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Map cart items to Stripe line_items — unit_amount is in cents
    const line_items = items.map((item: {
      nombre: string
      talla: string
      precioUnitario: number
      cantidad: number
    }) => ({
      price_data: {
        currency: "eur",
        product_data: {
          name: item.nombre,
          description: `Talla: ${item.talla}`,
        },
        unit_amount: Math.round(item.precioUnitario * 100),
      },
      quantity: item.cantidad,
    }))

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url,
      cancel_url,
    })

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
