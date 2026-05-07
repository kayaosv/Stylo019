import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import Stripe from "npm:stripe@13.3.0"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
})

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!
const ADMIN_EMAIL = "modastylo019@gmail.com"
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")!

serve(async (req) => {
  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return new Response("Missing signature", { status: 400 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET)
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return new Response("Invalid signature", { status: 400 })
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("Event ignored", { status: 200 })
  }

  const session = event.data.object as Stripe.Checkout.Session

  // Fetch full session with line items — fall back to event data if session doesn't exist (e.g. stripe trigger tests)
  let fullSession: Stripe.Checkout.Session
  try {
    fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items", "line_items.data.price.product", "shipping_cost.shipping_rate"],
    })
  } catch {
    fullSession = session
  }

  const items = fullSession.line_items?.data ?? []
  const customerEmail = fullSession.customer_details?.email ?? "—"
  const customerName = fullSession.customer_details?.name ?? "—"
  const total = ((fullSession.amount_total ?? 0) / 100).toFixed(2)

  const shipping = fullSession.shipping_details
  const shippingAddress = shipping?.address
    ? [
        shipping.name ?? customerName,
        shipping.address.line1,
        shipping.address.line2,
        `${shipping.address.postal_code ?? ""} ${shipping.address.city ?? ""}`.trim(),
        shipping.address.state ?? "",
        shipping.address.country ?? "",
      ].filter(Boolean).join("<br/>")
    : null

  const shippingZone = (fullSession.shipping_cost?.shipping_rate as any)?.display_name ?? null
  const shippingCost = fullSession.shipping_cost?.amount_total != null
    ? ((fullSession.shipping_cost.amount_total) / 100).toFixed(2)
    : null

  // Build items HTML for the email
  const itemsHtml = items
    .map((item) => {
      const imageUrl = (item.price?.product as any)?.images?.[0] ?? null
      const name = item.description ?? (item.price?.product as any)?.name ?? "—"
      return `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">
          <div style="display:flex; align-items:center; gap:10px;">
            ${imageUrl ? `<img src="${imageUrl}" alt="" width="48" height="48" style="object-fit:cover; border-radius:4px; flex-shrink:0;" />` : ""}
            <span>${name}</span>
          </div>
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; text-align:center;">${item.quantity}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; text-align:right;">€${((item.amount_total ?? 0) / 100).toFixed(2)}</td>
      </tr>`
    })
    .join("")

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><title>Nuevo pedido — Stylo019</title></head>
    <body style="margin:0;padding:0;background:#f5f0ea;font-family:Georgia,serif;">
      <div style="max-width:560px;margin:40px auto;background:#ffffff;border:1px solid #e5e5e5;">

        <div style="background:#0a0a0a;padding:28px 32px;">
          <p style="margin:0;color:#f5f0ea;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;">Stylo019</p>
          <h1 style="margin:8px 0 0;color:#f5f0ea;font-size:22px;font-weight:300;letter-spacing:-0.01em;">
            Nuevo pedido recibido
          </h1>
        </div>

        <div style="padding:32px;">
          <p style="margin:0 0 24px;color:#555;font-size:13px;font-family:Inter,sans-serif;line-height:1.6;">
            Se ha completado un pago en Stylo019. Aquí tienes el resumen:
          </p>

          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-family:Inter,sans-serif;font-size:13px;">
            <thead>
              <tr style="background:#f5f0ea;">
                <th style="padding:8px 12px;text-align:left;color:#0a0a0a;font-weight:500;">Producto</th>
                <th style="padding:8px 12px;text-align:center;color:#0a0a0a;font-weight:500;">Ud.</th>
                <th style="padding:8px 12px;text-align:right;color:#0a0a0a;font-weight:500;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding:12px 12px 4px;font-weight:600;color:#0a0a0a;font-family:Inter,sans-serif;font-size:13px;">Total pagado</td>
                <td style="padding:12px 12px 4px;text-align:right;font-weight:600;color:#0a0a0a;font-size:15px;">€${total}</td>
              </tr>
            </tfoot>
          </table>

          <div style="background:#f5f0ea;padding:16px 20px;margin-bottom:16px;">
            <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#888;font-family:Inter,sans-serif;">Cliente</p>
            <p style="margin:0;color:#0a0a0a;font-size:14px;font-family:Inter,sans-serif;">
              ${customerName}<br/>
              <a href="mailto:${customerEmail}" style="color:#0a0a0a;">${customerEmail}</a>
            </p>
          </div>

          ${shippingAddress ? `
          <div style="background:#f5f0ea;padding:16px 20px;margin-bottom:16px;">
            <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#888;font-family:Inter,sans-serif;">Dirección de envío</p>
            <p style="margin:0;color:#0a0a0a;font-size:14px;font-family:Inter,sans-serif;line-height:1.7;">
              ${shippingAddress}
            </p>
            ${shippingZone ? `<p style="margin:8px 0 0;font-size:12px;color:#555;font-family:Inter,sans-serif;">Zona: <strong>${shippingZone}</strong>${shippingCost === "0.00" ? " — <span style='color:#2a7a2a;'>Envío gratis</span>" : shippingCost ? ` — €${shippingCost}` : ""}</p>` : ""}
          </div>
          ` : `
          <div style="background:#fff3cd;padding:12px 20px;margin-bottom:16px;border-left:3px solid #f0a500;">
            <p style="margin:0;font-size:12px;color:#7a5800;font-family:Inter,sans-serif;">Sin dirección de envío — contactar al cliente por WhatsApp para confirmar.</p>
          </div>
          `}

          <p style="margin:0;font-size:12px;color:#aaa;font-family:Inter,sans-serif;">
            ID de sesión Stripe: ${session.id}
          </p>
        </div>

        <div style="background:#0a0a0a;padding:16px 32px;text-align:center;">
          <p style="margin:0;color:#555;font-size:11px;letter-spacing:0.15em;font-family:Inter,sans-serif;">
            STYLO019 · Av. Ildefonso Marañón Lavín, 9 · Sevilla
          </p>
        </div>
      </div>
    </body>
    </html>
  `

  // Send notification to admin via Resend
  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [ADMIN_EMAIL],
      subject: `🛍 Nuevo pedido — €${total} · ${customerName}`,
      html: emailHtml,
    }),
  })

  if (!resendRes.ok) {
    const err = await resendRes.text()
    console.error("Resend error:", err)
    return new Response("Email failed", { status: 500 })
  }

  return new Response("OK", { status: 200 })
})
