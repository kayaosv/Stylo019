// Input validation for crear-pedido-recogida.
//
// Pure functions with no Deno or network APIs so the same file runs under the
// edge runtime and under Vitest. Nothing here ever builds SQL, HTML or a
// prompt: every field is validated, normalised and later passed as a typed
// parameter. No field of this form is sent to a language model; if that ever
// changes, treat these values as untrusted data.

export type LineaValidada = {
  producto_id: string
  color_id: string | null
  talla: string
  cantidad: number
}

export type PedidoValidado = {
  items: LineaValidada[]
  nombre: string
  telefono: string
  email: string | null
  notas: string | null
  request_id: string
}

export type Campo = 'cuerpo' | 'items' | 'nombre' | 'telefono' | 'email' | 'notas' | 'request_id' | 'bot'
export type Resultado = { ok: true; valor: PedidoValidado } | { ok: false; campo: Campo }

const MAX_LINEAS = 10
const MAX_CANTIDAD_LINEA = 5
const MAX_UNIDADES = 20
const MIN_TIEMPO_MS = 2500
const MAX_TIEMPO_MS = 6 * 3600 * 1000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TALLA_RE = /^[\p{L}\p{N} ./-]{1,10}$/u
const COLOR_RE = /^[A-Za-z0-9_-]{1,64}$/
const EMAIL_RE = /^[^\s@<>"',;:()[\]\\]+@[^\s@<>"',;:()[\]\\]+\.[^\s@<>"',;:()[\]\\]{2,}$/

// Control characters, zero-width, bidirectional overrides and angle brackets.
const ESPECIALES = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁩﻿<>]/g

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const limpiarTexto = (valor: string): string =>
  valor
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .replace(ESPECIALES, '')
    .replace(/\s+/g, ' ')
    .trim()

const longitud = (texto: string): number => [...texto].length

const normalizarTelefono = (valor: unknown): string | null => {
  if (typeof valor !== 'string') return null
  let t = valor.replace(/[\s.\-()]/g, '')
  if (t.startsWith('00')) t = `+${t.slice(2)}`
  if (/^[6-9]\d{8}$/.test(t)) return `+34${t}`
  if (/^34[6-9]\d{8}$/.test(t)) return `+${t}`
  if (/^\+34[6-9]\d{8}$/.test(t)) return t
  if (/^\+(?!34)[1-9]\d{6,14}$/.test(t)) return t
  return null
}

const validarLineas = (valor: unknown): LineaValidada[] | null => {
  if (!Array.isArray(valor) || valor.length < 1 || valor.length > MAX_LINEAS) return null

  const lineas: LineaValidada[] = []
  let unidades = 0

  for (const item of valor) {
    if (!esObjeto(item)) return null
    const { id, colorId, talla, cantidad } = item

    if (typeof id !== 'string' || !UUID_RE.test(id)) return null
    if (typeof talla !== 'string' || !TALLA_RE.test(talla)) return null
    if (typeof cantidad !== 'number' || !Number.isInteger(cantidad)) return null
    if (cantidad < 1 || cantidad > MAX_CANTIDAD_LINEA) return null

    let color: string | null = null
    if (colorId !== null && colorId !== undefined) {
      if (typeof colorId !== 'string' || !COLOR_RE.test(colorId)) return null
      color = colorId
    }

    unidades += cantidad
    lineas.push({ producto_id: id.toLowerCase(), color_id: color, talla, cantidad })
  }

  return unidades > MAX_UNIDADES ? null : lineas
}

export const validarPedido = (body: unknown): Resultado => {
  const fallo = (campo: Campo): Resultado => ({ ok: false, campo })

  if (!esObjeto(body)) return fallo('cuerpo')

  const { request_id, empresa, elapsed_ms } = body

  if (typeof request_id !== 'string' || !UUID_RE.test(request_id)) return fallo('request_id')

  // Honeypot field (hidden in the form) and minimum fill time.
  if (empresa !== undefined && empresa !== null && empresa !== '') return fallo('bot')
  if (
    typeof elapsed_ms !== 'number' || !Number.isFinite(elapsed_ms) ||
    elapsed_ms < MIN_TIEMPO_MS || elapsed_ms > MAX_TIEMPO_MS
  ) return fallo('bot')

  const items = validarLineas(body.items)
  if (!items) return fallo('items')

  if (typeof body.nombre !== 'string') return fallo('nombre')
  const nombre = limpiarTexto(body.nombre)
  if (longitud(nombre) < 2 || longitud(nombre) > 80 || !/\p{L}/u.test(nombre)) return fallo('nombre')

  const telefono = normalizarTelefono(body.telefono)
  if (!telefono) return fallo('telefono')

  let email: string | null = null
  if (body.email !== undefined && body.email !== null && body.email !== '') {
    if (typeof body.email !== 'string') return fallo('email')
    const limpio = limpiarTexto(body.email).toLowerCase()
    if (limpio !== '') {
      if (longitud(limpio) > 120 || !EMAIL_RE.test(limpio)) return fallo('email')
      email = limpio
    }
  }

  let notas: string | null = null
  if (body.notas !== undefined && body.notas !== null && body.notas !== '') {
    if (typeof body.notas !== 'string') return fallo('notas')
    const limpio = limpiarTexto(body.notas)
    if (longitud(limpio) > 300) return fallo('notas')
    notas = limpio === '' ? null : limpio
  }

  return { ok: true, valor: { items, nombre, telefono, email, notas, request_id } }
}

const ORIGENES = new Set([
  'https://stylo019.es',
  'https://www.stylo019.es',
  'http://localhost:5173',
  'http://localhost:4173',
])

// Vercel deployments of this project (preview and production URLs). The team
// slug makes the host impossible to register from another Vercel account.
const PREVIEW_RE = /^https:\/\/stylo(-[a-z0-9]+)*-kayaosv-gmailcoms-projects\.vercel\.app$/

export const origenPermitido = (origen: string | null | undefined): boolean =>
  typeof origen === 'string' && (ORIGENES.has(origen) || PREVIEW_RE.test(origen))
