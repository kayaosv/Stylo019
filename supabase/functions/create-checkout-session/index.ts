import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@13.3.0?target=deno&no-check"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Never trusts price/stock the client sends — each cart line is
// re-resolved against the live catalog via resolver_linea_checkout()
// (same price hierarchy as src/lib/precio.js) before building the Stripe
// session. The order itself is NOT created here and stock is NOT
// decremented here — that only happens once Stripe confirms payment (see
// stripe-webhook), so the cart is staged in checkout_drafts in the
// meantime and picked up there via session.metadata.draft_id.

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

// success_url/cancel_url come from the client to build the return link —
// validated against a whitelist instead of trusted blindly, so this
// endpoint can't be used to mint a real Stripe payment link that redirects
// to an unrelated domain after charging the card.
const ALLOWED_ORIGIN_SUFFIXES = [
  ".vercel.app",
  "stylo019.es",
  "localhost:5173",
  "localhost:4173",
]

const isAllowedUrl = (url: string) => {
  try {
    const { host, hostname } = new URL(url)
    return ALLOWED_ORIGIN_SUFFIXES.some((s) => hostname === s || hostname.endsWith(`.${s}`) || hostname.endsWith(s) || host === s)
  } catch {
    return false
  }
}

interface CartItem {
  id: string
  colorId?: string | null
  talla: string
  cantidad: number
  colorLabel?: string | null
  colorImagen?: string | null
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
      return json({ error: "Carrito vacío" }, 400)
    }
    if (!success_url || !cancel_url || !isAllowedUrl(success_url) || !isAllowedUrl(cancel_url)) {
      return json({ error: "URL de retorno no permitida" }, 400)
    }

    for (const item of items as CartItem[]) {
      if (!item.id || !item.talla || !item.cantidad || item.cantidad <= 0) {
        return json({ error: "Línea de carrito inválida" }, 400)
      }
    }

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    const draftItems: { producto_id: string; color_id: string | null; talla: string; cantidad: number }[] = []
    let subtotal = 0

    for (const item of items as CartItem[]) {
      const colorId = item.colorId ?? null

      const { data, error } = await supabase.rpc("resolver_linea_checkout", {
        p_producto_id: item.id,
        p_color_id: colorId,
        p_talla: item.talla,
      })
      if (error) throw error

      const line = Array.isArray(data) ? data[0] : data
      if (!line?.disponible) {
        return json({ error: `"${line?.producto_nombre ?? "Producto"}" ya no está disponible` }, 409)
      }
      if (line.stock_disponible < item.cantidad) {
        return json({ error: `Solo quedan ${line.stock_disponible} unidades de "${line.producto_nombre}"` }, 409)
      }

      const nameParts = [line.producto_nombre]
      if (line.color_label) nameParts.push(line.color_label)
      if (item.talla) nameParts.push(`Talla ${item.talla}`)
      const image = item.colorImagen ?? item.imagenes?.[0]

      const unitPrice = Number(line.precio_unitario)
      subtotal += unitPrice * item.cantidad

      line_items.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: nameParts.join(" — "),
            ...(image ? { images: [image] } : {}),
          },
          unit_amount: Math.round(unitPrice * 100),
        },
        quantity: item.cantidad,
      })

      draftItems.push({ producto_id: item.id, color_id: colorId, talla: item.talla, cantidad: item.cantidad })
    }

    const { data: draft, error: draftError } = await supabase
      .from("checkout_drafts")
      .insert({ items: draftItems })
      .select("id")
      .single()

    if (draftError) throw draftError

    // Fetch shipping config from site_settings — errors fall back to safe defaults
    const [{ data: zonasRow }, { data: umbralRow }] = await Promise.all([
      supabase.from("site_settings").select("value").eq("key", "envios_zonas").single(),
      supabase.from("site_settings").select("value").eq("key", "envio_gratis_umbral").single(),
    ])

    const zonas: ShippingZone[] = zonasRow?.value ?? []
    const umbral: number = umbralRow?.value ?? 50
    const isFreeShipping = subtotal >= umbral

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
      metadata: { draft_id: draft.id },
    }

    if (shippingOptions.length > 0) {
      sessionParams.shipping_options = shippingOptions
      sessionParams.shipping_address_collection = { allowed_countries: ["ES"] }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return json({ url: session.url, sessionId: session.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido"
    return json({ error: message }, 500)
  }
})
