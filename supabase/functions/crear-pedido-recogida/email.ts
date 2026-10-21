// Admin notification email for a new "recogida y pago en tienda" reservation.
// Every value that came from the customer goes through escaparHtml().

export type LineaEmail = {
  producto_nombre: string
  color_label: string | null
  talla: string
  cantidad: number
  precio_unitario: number
}

export type PedidoEmail = {
  numero_ticket: number
  total: number
  creado_el: string
  expira_el: string
  cliente_nombre: string
  cliente_telefono: string
  cliente_email: string | null
  notas: string | null
  lineas: LineaEmail[]
}

const ADMIN_PEDIDOS_URL = 'https://www.stylo019.es/admin/pedidos'

const ENTIDADES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export const escaparHtml = (valor: unknown): string =>
  valor === null || valor === undefined ? '' : String(valor).replace(/[&<>"']/g, (c) => ENTIDADES[c])

const textoPlano = (valor: string): string => valor.replace(/[<>\r\n]/g, ' ').replace(/\s+/g, ' ').trim()

const euros = (n: number): string => `€${Number(n).toFixed(2)}`

const fecha = (iso: string): string =>
  new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))

export const construirEmailAdmin = (pedido: PedidoEmail): { asunto: string; html: string } => {
  const asunto = textoPlano(
    `Nueva reserva #${pedido.numero_ticket} — ${euros(pedido.total)} · ${pedido.cliente_nombre}`,
  ).slice(0, 120)

  const filas = pedido.lineas
    .map((l) => {
      const detalle = [l.color_label, `Talla ${l.talla}`].filter(Boolean).map(escaparHtml).join(' — ')
      return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;">${escaparHtml(l.producto_nombre)}<br/><span style="color:#777;font-size:12px;">${detalle}</span></td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;text-align:center;">${escaparHtml(l.cantidad)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;text-align:right;">${euros(l.precio_unitario * l.cantidad)}</td>
      </tr>`
    })
    .join('')

  const telefonoWa = pedido.cliente_telefono.replace(/\D/g, '')

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Nueva reserva — Stylo019</title></head>
<body style="margin:0;padding:0;background:#f5f0ea;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border:1px solid #e5e5e5;">
    <div style="background:#0a0a0a;padding:28px 32px;">
      <p style="margin:0;color:#f5f0ea;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;">Stylo019</p>
      <h1 style="margin:8px 0 0;color:#f5f0ea;font-size:22px;font-weight:300;">Nueva reserva #${escaparHtml(pedido.numero_ticket)}</h1>
    </div>
    <div style="padding:32px;font-family:Inter,sans-serif;font-size:13px;color:#0a0a0a;">
      <p style="margin:0 0 20px;background:#fff3cd;padding:12px 16px;border-left:3px solid #f0a500;">
        <strong>Pendiente de cobro</strong> — recogida y pago en tienda. Stock reservado hasta el ${fecha(pedido.expira_el)}.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead><tr style="background:#f5f0ea;">
          <th style="padding:8px 12px;text-align:left;">Producto</th>
          <th style="padding:8px 12px;text-align:center;">Ud.</th>
          <th style="padding:8px 12px;text-align:right;">Total</th>
        </tr></thead>
        <tbody>${filas}</tbody>
        <tfoot><tr>
          <td colspan="2" style="padding:12px;font-weight:600;">Total a cobrar</td>
          <td style="padding:12px;text-align:right;font-weight:600;">${euros(pedido.total)}</td>
        </tr></tfoot>
      </table>
      <div style="background:#f5f0ea;padding:16px 20px;margin-bottom:16px;">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#888;">Cliente</p>
        <p style="margin:0;line-height:1.7;">
          ${escaparHtml(pedido.cliente_nombre)}<br/>
          ${escaparHtml(pedido.cliente_telefono)} · <a href="https://wa.me/${telefonoWa}" style="color:#0a0a0a;">Escribir por WhatsApp</a>
          ${pedido.cliente_email ? `<br/>${escaparHtml(pedido.cliente_email)}` : ''}
          ${pedido.notas ? `<br/><em>${escaparHtml(pedido.notas)}</em>` : ''}
        </p>
      </div>
      <p style="margin:0;"><a href="${ADMIN_PEDIDOS_URL}" style="color:#0a0a0a;">Gestionar en /admin/pedidos</a></p>
    </div>
  </div>
</body>
</html>`

  return { asunto, html }
}
