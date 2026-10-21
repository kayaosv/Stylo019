// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { manejar, type Deps } from './handler.ts'

const UUID = '3f2b8d1e-6a4c-4b9e-8f10-2c5d7a9b1e34'
const REQUEST_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const ORIGEN = 'https://www.stylo019.es'

const cuerpoValido = (extra = {}) => ({
  items: [{ id: UUID, colorId: 'negro', talla: 'M', cantidad: 1 }],
  nombre: 'María José',
  telefono: '638 970 807',
  email: 'maria@example.com',
  notas: 'Paso por la tarde',
  request_id: REQUEST_ID,
  empresa: '',
  elapsed_ms: 9000,
  ...extra,
})

const respuestaRpc = (extra = {}) => ({
  ok: true,
  venta_id: 'no-debe-salir-al-navegador',
  numero_ticket: 67,
  total: 25.9,
  creado_el: '2026-10-21T10:30:00.000Z',
  expira_el: '2026-10-28T10:30:00.000Z',
  cliente_nombre: 'María José',
  cliente_telefono: '+34638970807',
  lineas: [{ producto_nombre: 'Falda Ibiza', color_label: 'Negro', talla: 'M', cantidad: 1, precio_unitario: 25.9 }],
  ...extra,
})

const crearDeps = (extra: Partial<Deps> = {}): Deps & { crearPedido: ReturnType<typeof vi.fn>; enviarEmail: ReturnType<typeof vi.fn> } => ({
  crearPedido: vi.fn().mockResolvedValue(respuestaRpc()),
  enviarEmail: vi.fn().mockResolvedValue(undefined),
  salt: 'sal-de-prueba',
  ...extra,
}) as never

const peticion = (cuerpo: unknown, { origen = ORIGEN, metodo = 'POST', ip = '203.0.113.7', crudo }: { origen?: string | null; metodo?: string; ip?: string | null; crudo?: string } = {}) => {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (origen !== null) headers.set('origin', origen)
  if (ip !== null) headers.set('cf-connecting-ip', ip)
  return new Request('https://x.supabase.co/functions/v1/crear-pedido-recogida', {
    method: metodo,
    headers,
    body: metodo === 'POST' ? (crudo ?? JSON.stringify(cuerpo)) : undefined,
  })
}

describe('manejar — reserva correcta', () => {
  it('devuelve 200 con el resumen y sin exponer el id interno', async () => {
    const deps = crearDeps()
    const res = await manejar(peticion(cuerpoValido()), deps)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.numero_ticket).toBe(67)
    expect(json.lineas).toHaveLength(1)
    expect(json).not.toHaveProperty('venta_id')
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGEN)
  })

  it('pasa a la base de datos solo datos validados, nunca precios ni totales del navegador', async () => {
    const deps = crearDeps()
    await manejar(peticion(cuerpoValido({ total: 0.01, items: [{ id: UUID, colorId: null, talla: 'M', cantidad: 1, precio: 0.01 }] })), deps)

    const args = deps.crearPedido.mock.calls[0][0]
    expect(args.items).toEqual([{ producto_id: UUID, color_id: null, talla: 'M', cantidad: 1 }])
    expect(args.telefono).toBe('+34638970807')
    expect(args.requestId).toBe(REQUEST_ID)
    expect(JSON.stringify(args)).not.toContain('0.01')
  })

  it('guarda un hash de la IP, nunca la IP, y depende de la sal', async () => {
    const a = crearDeps()
    const b = crearDeps({ salt: 'otra-sal' })
    await manejar(peticion(cuerpoValido(), { ip: '203.0.113.7' }), a)
    await manejar(peticion(cuerpoValido(), { ip: '203.0.113.7' }), b)

    const hashA = a.crearPedido.mock.calls[0][0].ipHash
    const hashB = b.crearPedido.mock.calls[0][0].ipHash
    expect(hashA).toMatch(/^[0-9a-f]{64}$/)
    expect(hashA).not.toContain('203.0.113.7')
    expect(hashA).not.toBe(hashB)
  })

  it('envía el email al admin con el resumen', async () => {
    const deps = crearDeps()
    await manejar(peticion(cuerpoValido()), deps)

    expect(deps.enviarEmail).toHaveBeenCalledTimes(1)
    const [asunto, html] = deps.enviarEmail.mock.calls[0]
    expect(asunto).toContain('#67')
    expect(html).toContain('Falda Ibiza')
    expect(html).toContain('maria@example.com')
    expect(html).toContain('Paso por la tarde')
  })

  it('si el email falla, la reserva sigue siendo correcta', async () => {
    const deps = crearDeps({ enviarEmail: vi.fn().mockRejectedValue(new Error('Resend caído')) })
    const res = await manejar(peticion(cuerpoValido()), deps)
    expect(res.status).toBe(200)
  })

  it('un reintento (repetido) no vuelve a enviar el email', async () => {
    const deps = crearDeps({ crearPedido: vi.fn().mockResolvedValue(respuestaRpc({ repetido: true })) })
    const res = await manejar(peticion(cuerpoValido()), deps)
    expect(res.status).toBe(200)
    expect(deps.enviarEmail).not.toHaveBeenCalled()
  })
})

describe('manejar — rechazos', () => {
  it('rechaza orígenes no permitidos con 403 y sin tocar la base de datos', async () => {
    for (const origen of ['https://evilstylo019.es', 'https://stylo019.es.evil.com', null]) {
      const deps = crearDeps()
      const res = await manejar(peticion(cuerpoValido(), { origen }), deps)
      expect(res.status).toBe(403)
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
      expect(deps.crearPedido).not.toHaveBeenCalled()
    }
  })

  it('responde al preflight OPTIONS solo a orígenes permitidos', async () => {
    const ok = await manejar(peticion(undefined, { metodo: 'OPTIONS' }), crearDeps())
    expect(ok.status).toBe(204)
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGEN)
    expect(ok.headers.get('access-control-allow-headers')).toContain('content-type')

    const mal = await manejar(peticion(undefined, { metodo: 'OPTIONS', origen: 'https://evil.com' }), crearDeps())
    expect(mal.status).toBe(403)
  })

  it('rechaza métodos distintos de POST', async () => {
    const res = await manejar(peticion(undefined, { metodo: 'GET' }), crearDeps())
    expect(res.status).toBe(405)
  })

  it('rechaza cuerpos enormes con 413', async () => {
    const deps = crearDeps()
    const res = await manejar(peticion(cuerpoValido({ notas: 'x'.repeat(20_000) })), deps)
    expect(res.status).toBe(413)
    expect(deps.crearPedido).not.toHaveBeenCalled()
  })

  it('rechaza JSON mal formado con 400', async () => {
    const deps = crearDeps()
    const res = await manejar(peticion(null, { crudo: '{no es json' }), deps)
    expect(res.status).toBe(400)
    expect(deps.crearPedido).not.toHaveBeenCalled()
  })

  it('rechaza datos inválidos con 400 e indica el campo', async () => {
    const deps = crearDeps()
    const res = await manejar(peticion(cuerpoValido({ telefono: 'abc' })), deps)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.campo).toBe('telefono')
    expect(deps.crearPedido).not.toHaveBeenCalled()
  })

  it('un bot (señuelo relleno o demasiado rápido) recibe 400 sin pista del motivo', async () => {
    for (const extra of [{ empresa: 'ACME' }, { elapsed_ms: 300 }]) {
      const deps = crearDeps()
      const res = await manejar(peticion(cuerpoValido(extra)), deps)
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json).not.toHaveProperty('campo')
      expect(deps.crearPedido).not.toHaveBeenCalled()
    }
  })
})

describe('manejar — respuestas de la base de datos', () => {
  it.each(['LIMITE_IP', 'LIMITE_TELEFONO', 'LIMITE_GLOBAL'])('%s devuelve 429 con mensaje genérico', async (code) => {
    const deps = crearDeps({ crearPedido: vi.fn().mockResolvedValue({ ok: false, code }) })
    const res = await manejar(peticion(cuerpoValido()), deps)
    const json = await res.json()
    expect(res.status).toBe(429)
    expect(json.error).toContain('WhatsApp')
    expect(JSON.stringify(json)).not.toContain(code)
  })

  it('un error de negocio (stock) devuelve 409 con el motivo para la clienta', async () => {
    const deps = crearDeps({
      crearPedido: vi.fn().mockResolvedValue({ ok: false, code: 'NEGOCIO', message: 'Solo quedan 1 unidades de "Falda Ibiza" talla M' }),
    })
    const res = await manejar(peticion(cuerpoValido()), deps)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Solo quedan 1 unidades de "Falda Ibiza" talla M')
    expect(deps.enviarEmail).not.toHaveBeenCalled()
  })

  it('un error interno devuelve 500 genérico sin filtrar detalles', async () => {
    const deps = crearDeps({ crearPedido: vi.fn().mockRejectedValue(new Error('connection to db.internal:5432 failed password=secreto')) })
    const res = await manejar(peticion(cuerpoValido()), deps)
    const texto = await res.text()
    expect(res.status).toBe(500)
    expect(texto).not.toContain('secreto')
    expect(texto).not.toContain('5432')
  })

  it('un resultado interno de la base de datos tampoco filtra detalles', async () => {
    const deps = crearDeps({ crearPedido: vi.fn().mockResolvedValue({ ok: false, code: 'INTERNO', message: 'detalle interno' }) })
    const res = await manejar(peticion(cuerpoValido()), deps)
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('detalle interno')
  })
})
