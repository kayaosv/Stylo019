// ModaMariaJose — syncs a TPV sale with Odoo (legal invoice). Called
// fire-and-forget from VentaFisica.jsx right after crear_venta_tpv() — the
// sale is already confirmed and stock already decremented at that point,
// this function never blocks or reverts a sale if it fails. The result
// (synced/error) lands in ventas.odoo_sync_status.
//
// Same stub shape as Vapers Alcosa's odoo-sync: creates a simple
// account.move (customer invoice draft). Revisit pos.order vs account.move
// once real Odoo credentials + Veri*Factu setup exist for this business.

import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

type OdooRpcResult = { result?: unknown; error?: { message?: string; data?: { message?: string } } }

const odooCall = async (url: string, service: string, method: string, args: unknown[]) => {
  const res = await fetch(`${url.replace(/\/$/, "")}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: crypto.randomUUID(),
    }),
  })

  const data: OdooRpcResult = await res.json()
  if (data.error) {
    throw new Error(data.error.data?.message ?? data.error.message ?? "Error desconocido de Odoo")
  }
  return data.result
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  const markError = async (ventaId: string, message: string) => {
    await supabase
      .from("ventas")
      .update({ odoo_sync_status: "error", odoo_sync_error: message })
      .eq("id", ventaId)
  }

  // Kept outside the try so the catch can mark the sale as error even if
  // what failed was the Odoo call itself, not the body parsing.
  let ventaId: string | undefined

  try {
    const body = await req.json()
    ventaId = body.venta_id
    if (!ventaId) return json({ error: "Falta venta_id" }, 400)

    const odooUrl = Deno.env.get("ODOO_URL")
    const odooDb = Deno.env.get("ODOO_DB")
    const odooUser = Deno.env.get("ODOO_API_USER")
    const odooApiKey = Deno.env.get("ODOO_API_KEY")

    if (!odooUrl || !odooDb || !odooUser || !odooApiKey) {
      await markError(ventaId, "Odoo no configurado todavía (faltan credenciales)")
      return json({ synced: false, error: "Odoo no configurado todavía" })
    }

    const { data: venta, error: ventaError } = await supabase
      .from("ventas")
      .select("id, total, created_at, venta_items(producto_nombre, color_label, talla, precio_unitario, cantidad)")
      .eq("id", ventaId)
      .single()

    if (ventaError || !venta) {
      await markError(ventaId, ventaError?.message ?? "Venta no encontrada")
      return json({ synced: false, error: "Venta no encontrada" })
    }

    const uid = await odooCall(odooUrl, "common", "login", [odooDb, odooUser, odooApiKey])
    if (!uid) throw new Error("Login de Odoo falló (credenciales inválidas)")

    const invoiceLines = (venta.venta_items ?? []).map((item: {
      producto_nombre: string; color_label: string | null; talla: string; precio_unitario: number; cantidad: number
    }) => {
      const detalle = [item.color_label, `Talla ${item.talla}`].filter(Boolean).join(' — ')
      return [0, 0, {
        name: `${item.producto_nombre} — ${detalle}`,
        quantity: item.cantidad,
        price_unit: item.precio_unitario,
      }]
    })

    const invoiceId = await odooCall(odooUrl, "object", "execute_kw", [
      odooDb, uid, odooApiKey,
      "account.move", "create",
      [{
        move_type: "out_invoice",
        invoice_line_ids: invoiceLines,
      }],
    ])

    await supabase
      .from("ventas")
      .update({ odoo_sync_status: "synced", odoo_invoice_id: String(invoiceId), odoo_sync_error: null })
      .eq("id", ventaId)

    return json({ synced: true, odoo_invoice_id: invoiceId })
  } catch (err) {
    console.error("odoo-sync error:", err)
    const message = err instanceof Error ? err.message : "Error desconocido"
    if (ventaId) await markError(ventaId, message)
    return json({ synced: false, error: message })
  }
})
