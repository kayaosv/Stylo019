// Request handler for crear-pedido-recogida. Kept free of Deno globals and of
// any client library so it can be tested with injected dependencies; index.ts
// wires it to Supabase and Resend.

import { origenPermitido, validarPedido, type LineaValidada } from './validacion.ts'
import { construirEmailAdmin } from './email.ts'

export type RespuestaRpc = {
  ok: boolean
  code?: string
  message?: string
  repetido?: boolean
  numero_ticket?: number
  total?: number
  creado_el?: string
  expira_el?: string
  cliente_nombre?: string
  cliente_telefono?: string
  lineas?: {
    producto_nombre: string
    color_label: string | null
    talla: string
    cantidad: number
    precio_unitario: number
  }[]
  [clave: string]: unknown
}

export type Deps = {
  crearPedido: (args: {
    items: LineaValidada[]
    nombre: string
    telefono: string
    email: string | null
    notas: string | null
    ipHash: string
    requestId: string
  }) => Promise<RespuestaRpc>
  enviarEmail: (asunto: string, html: string) => Promise<void>
  salt: string
}

const MAX_BYTES = 10_000
const MSG_LIMITE = 'Hemos recibido demasiadas solicitudes. Escríbenos por WhatsApp y te ayudamos.'
const MSG_INTERNO = 'No se pudo crear la reserva. Inténtalo de nuevo o escríbenos por WhatsApp.'

const cabeceras = (origen: string | null): Record<string, string> => ({
  'Content-Type': 'application/json',
  Vary: 'Origin',
  ...(origen
    ? {
      'Access-Control-Allow-Origin': origen,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
    : {}),
})

const responder = (estado: number, cuerpo: unknown, origen: string | null): Response =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras(origen) })

const hashIp = async (ip: string, salt: string): Promise<string> => {
  const datos = new TextEncoder().encode(`${salt}:${ip}`)
  const resumen = await crypto.subtle.digest('SHA-256', datos)
  return [...new Uint8Array(resumen)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const manejar = async (req: Request, deps: Deps): Promise<Response> => {
  const origenCabecera = req.headers.get('origin')
  if (!origenPermitido(origenCabecera)) {
    return responder(403, { error: 'Origen no permitido' }, null)
  }
  const origen = origenCabecera

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabeceras(origen) })
  if (req.method !== 'POST') return responder(405, { error: 'Método no permitido' }, origen)

  const texto = await req.text()
  if (new TextEncoder().encode(texto).length > MAX_BYTES) {
    return responder(413, { error: 'Solicitud demasiado grande' }, origen)
  }

  let cuerpo: unknown
  try {
    cuerpo = JSON.parse(texto)
  } catch {
    return responder(400, { error: 'Solicitud no válida' }, origen)
  }

  const validado = validarPedido(cuerpo)
  if (!validado.ok) {
    // Do not tell bots which anti-abuse check they tripped.
    return validado.campo === 'bot'
      ? responder(400, { error: 'No se pudo procesar la solicitud' }, origen)
      : responder(400, { error: 'Revisa los datos del formulario', campo: validado.campo }, origen)
  }
  const pedido = validado.valor

  // Cloudflare sets this header and clients cannot forge it; without it all
  // callers share one bucket, which is the strictest outcome.
  const ip = req.headers.get('cf-connecting-ip') ?? 'desconocida'

  let resultado: RespuestaRpc
  try {
    resultado = await deps.crearPedido({
      items: pedido.items,
      nombre: pedido.nombre,
      telefono: pedido.telefono,
      email: pedido.email,
      notas: pedido.notas,
      ipHash: await hashIp(ip, deps.salt),
      requestId: pedido.request_id,
    })
  } catch {
    console.error('crear-pedido-recogida: fallo al llamar a la base de datos')
    return responder(500, { error: MSG_INTERNO }, origen)
  }

  if (!resultado.ok) {
    if (resultado.code?.startsWith('LIMITE_')) return responder(429, { error: MSG_LIMITE }, origen)
    if (resultado.code === 'NEGOCIO' && resultado.message) {
      return responder(409, { error: resultado.message }, origen)
    }
    return responder(500, { error: MSG_INTERNO }, origen)
  }

  if (!resultado.repetido) {
    try {
      const { asunto, html } = construirEmailAdmin({
        numero_ticket: resultado.numero_ticket as number,
        total: resultado.total as number,
        creado_el: resultado.creado_el as string,
        expira_el: resultado.expira_el as string,
        cliente_nombre: resultado.cliente_nombre as string,
        cliente_telefono: resultado.cliente_telefono as string,
        cliente_email: pedido.email,
        notas: pedido.notas,
        lineas: resultado.lineas ?? [],
      })
      await deps.enviarEmail(asunto, html)
    } catch {
      // The reservation is already saved; a failed notification must not undo it.
      console.error('crear-pedido-recogida: no se pudo enviar el email al admin')
    }
  }

  const { venta_id: _ventaId, repetido: _repetido, ok: _ok, ...publico } = resultado
  return responder(200, publico, origen)
}
