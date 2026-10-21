import { WHATSAPP_NUMBER, DIRECCION } from '@/lib/tienda'

// Receipt for a "recogida y pago en tienda" reservation. It is built from the
// server's response, not from the browser cart, so it shows what was saved.

const euros = (n) => `€${Number(n).toFixed(2)}`

const formatoFecha = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const formatoFechaHora = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const formatearTelefono = (tel) => {
  const m = /^\+34(\d{3})(\d{3})(\d{3})$/.exec(tel ?? '')
  return m ? `+34 ${m[1]} ${m[2]} ${m[3]}` : tel
}

const nombreLinea = (l) => (l.color_label ? `${l.producto_nombre} (${l.color_label})` : l.producto_nombre)

const nombreArchivo = (pedido) => `comprobante-reserva-${pedido.numero_ticket}.png`

export const comprobanteLineas = (pedido) => [
  { tipo: 'titulo', texto: `Reserva #${pedido.numero_ticket}` },
  { tipo: 'sub', texto: 'Stylo019 · Recogida y pago en tienda' },
  { tipo: 'meta', texto: `Fecha: ${formatoFechaHora.format(new Date(pedido.creado_el))}` },
  { tipo: 'meta', texto: `Cliente: ${pedido.cliente_nombre} · ${formatearTelefono(pedido.cliente_telefono)}` },
  { tipo: 'sep' },
  ...pedido.lineas.map((l) => ({
    tipo: 'item',
    texto: nombreLinea(l),
    detalle: `Talla ${l.talla} × ${l.cantidad}`,
    importe: euros(l.precio_unitario * l.cantidad),
  })),
  { tipo: 'sep' },
  { tipo: 'total', texto: 'Total a pagar en tienda', importe: euros(pedido.total) },
  { tipo: 'aviso', texto: 'Método de pago: recogida y pago en tienda — pendiente de pago' },
  { tipo: 'meta', texto: `Reserva válida hasta el ${formatoFecha.format(new Date(pedido.expira_el))}` },
  { tipo: 'meta', texto: DIRECCION },
]

export const comprobanteTexto = (pedido) =>
  [
    `*Reserva #${pedido.numero_ticket} — Stylo019*`,
    'Método de pago: recogida y pago en tienda (pendiente de pago)',
    '',
    ...pedido.lineas.map(
      (l) => `• ${nombreLinea(l)} — Talla ${l.talla} x${l.cantidad} (${euros(l.precio_unitario * l.cantidad)})`,
    ),
    '',
    `Total: ${euros(pedido.total)}`,
    `Cliente: ${pedido.cliente_nombre} · ${formatearTelefono(pedido.cliente_telefono)}`,
    `Reserva válida hasta el ${formatoFecha.format(new Date(pedido.expira_el))}`,
    DIRECCION,
  ].join('\n')

export const whatsappUrl = (pedido) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(comprobanteTexto(pedido))}`

const ANCHO = 800
const MARGEN = 48
const ESCALA = 2
const COLOR_TEXTO = '#0a0a0a'
const COLOR_SUAVE = '#6b6b6b'
const FUENTE = 'Georgia, "Times New Roman", serif'

// Breaks text into lines that fit maxAncho, splitting very long words too.
const partirTexto = (ctx, texto, maxAncho) => {
  const lineas = []
  let actual = ''
  const palabras = String(texto).split(' ')

  const meter = (palabra) => {
    let resto = palabra
    while (ctx.measureText(resto).width > maxAncho && resto.length > 1) {
      let corte = resto.length - 1
      while (corte > 1 && ctx.measureText(resto.slice(0, corte)).width > maxAncho) corte -= 1
      lineas.push(resto.slice(0, corte))
      resto = resto.slice(corte)
    }
    return resto
  }

  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra
    if (ctx.measureText(prueba).width <= maxAncho) {
      actual = prueba
    } else {
      if (actual) lineas.push(actual)
      actual = meter(palabra)
    }
  }
  if (actual) lineas.push(actual)
  return lineas
}

const ESTILOS = {
  titulo: { fuente: `700 36px ${FUENTE}`, color: COLOR_TEXTO, alto: 46 },
  sub: { fuente: `400 20px ${FUENTE}`, color: COLOR_SUAVE, alto: 30 },
  meta: { fuente: `400 17px ${FUENTE}`, color: COLOR_SUAVE, alto: 26 },
  item: { fuente: `400 21px ${FUENTE}`, color: COLOR_TEXTO, alto: 29 },
  detalle: { fuente: `400 16px ${FUENTE}`, color: COLOR_SUAVE, alto: 24 },
  total: { fuente: `700 26px ${FUENTE}`, color: COLOR_TEXTO, alto: 40 },
  aviso: { fuente: `700 18px ${FUENTE}`, color: COLOR_TEXTO, alto: 28 },
}

export const generarComprobantePng = (pedido) =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('No se pudo generar el comprobante'))
      return
    }

    // First pass: lay the rows out so the canvas height fits the content.
    const filas = []
    let y = MARGEN
    const anchoUtil = ANCHO - MARGEN * 2

    for (const linea of comprobanteLineas(pedido)) {
      if (linea.tipo === 'sep') {
        y += 10
        filas.push({ tipo: 'sep', y })
        y += 22
        continue
      }
      const estilo = ESTILOS[linea.tipo]
      ctx.font = estilo.fuente
      const reservado = linea.importe ? 150 : 0
      const partes = partirTexto(ctx, linea.texto, anchoUtil - reservado)
      partes.forEach((texto, i) => {
        y += estilo.alto
        filas.push({ tipo: linea.tipo, texto, y, importe: i === 0 ? linea.importe : undefined })
      })
      if (linea.detalle) {
        ctx.font = ESTILOS.detalle.fuente
        y += ESTILOS.detalle.alto
        filas.push({ tipo: 'detalle', texto: linea.detalle, y })
      }
    }
    const alto = y + MARGEN

    canvas.width = ANCHO * ESCALA
    canvas.height = alto * ESCALA
    ctx.scale(ESCALA, ESCALA)

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ANCHO, alto)
    ctx.textBaseline = 'alphabetic'

    for (const fila of filas) {
      if (fila.tipo === 'sep') {
        ctx.strokeStyle = '#cfcfcf'
        ctx.lineWidth = 1
        ctx.setLineDash([6, 6])
        ctx.beginPath()
        ctx.moveTo(MARGEN, fila.y)
        ctx.lineTo(ANCHO - MARGEN, fila.y)
        ctx.stroke()
        ctx.setLineDash([])
        continue
      }
      const estilo = ESTILOS[fila.tipo]
      ctx.font = estilo.fuente
      ctx.fillStyle = estilo.color
      ctx.textAlign = 'left'
      ctx.fillText(fila.texto, MARGEN, fila.y)
      if (fila.importe) {
        ctx.textAlign = 'right'
        ctx.fillText(fila.importe, ANCHO - MARGEN, fila.y)
      }
    }

    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el comprobante'))),
      'image/png',
    )
  })

const descargarBlob = (blob, nombre) => {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const descargarComprobante = async (pedido) => {
  descargarBlob(await generarComprobantePng(pedido), nombreArchivo(pedido))
}

// Opens the store's chat (wa.me/<number>) with the receipt text already
// written, so the customer only has to press send. The share sheet is not used:
// it cannot be aimed at a number and opens WhatsApp's chat list instead.
export const enviarComprobanteWhatsApp = (pedido) => {
  window.open(whatsappUrl(pedido), '_blank', 'noopener,noreferrer')
}
