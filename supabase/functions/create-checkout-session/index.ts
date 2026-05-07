import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@13.3.0?target=deno&no-check"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
})

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by Supabase
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface CartItem {
  nombre: string
  talla: string
  precioUnitario: number
  cantidad: number
  imagenes?: string[]
}

interface ShippingZone {
  id: string
  nombre: string
  precio: number | null
  activo: boolean
}

serve(async (req) => {
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

    const line_items = items.map((item: CartItem) => ({
      price_data: {
        currency: "eur",
        product_data: {
          name: item.talla ? `${item.nombre} — Talla ${item.talla}` : item.nombre,
          ...(item.imagenes?.[0] ? { images: [item.imagenes[0]] } : {}),
        },
        unit_amount: Math.round(item.precioUnitario * 100),
      },
      quantity: item.cantidad,
    }))

    // Subtotal in euros to evaluate free shipping threshold
    const subtotal = items.reduce(
      (sum: number, item: CartItem) => sum + item.precioUnitario * item.cantidad,
      0
    )

    // Fetch shipping config from site_settings — errors fall back to safe defaults
    const [{ data: zonasRow }, { data: umbralRow }] = await Promise.all([
      supabase.from("site_settings").select("value").eq("key", "envios_zonas").single(),
      supabase.from("site_settings").select("value").eq("key", "envio_gratis_umbral").single(),
    ])

    const zonas: ShippingZone[] = zonasRow?.value ?? []
    const umbral: number = umbralRow?.value ?? 50
    const isFreeShipping = subtotal >= umbral

    // Build Stripe shipping_options — only active zones with a price, max 5 (Stripe limit)
    const shippingOptions = zonas
      .filter((z) => z.activo && z.precio != null)
      .slice(0, 5)
      .map((z) => ({
        shipping_rate_data: {
          type: "fixed_amount" as const,
          fixed_amount: {
            amount: isFreeShipping ? 0 : Math.round(z.precio! * 100),
            currency: "eur",
          },
          display_name: isFreeShipping ? `${z.nombre} — Envío gratis` : z.nombre,
        },
      }))

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url,
      cancel_url,
    }

    if (shippingOptions.length > 0) {
      sessionParams.shipping_options = shippingOptions
      sessionParams.shipping_address_collection = { allowed_countries: ["ES"] }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

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
