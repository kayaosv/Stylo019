import { describe, it, expect, beforeEach } from 'vitest'
import {
  validarFormulario,
  construirPayload,
  guardarUltimaReserva,
  leerUltimaReserva,
} from '@/lib/reserva'

const valido = (extra = {}) => ({
  nombre: 'María José',
  telefono: '638 970 807',
  email: '',
  notas: '',
  ...extra,
})

describe('validarFormulario', () => {
  it('acepta nombre y teléfono; email y notas son opcionales', () => {
    const { ok, errores, valores } = validarFormulario(valido())
    expect(ok).toBe(true)
    expect(errores).toEqual({})
    expect(valores.telefono).toBe('+34638970807')
    expect(valores.email).toBeNull()
  })

  it('exige nombre y teléfono con mensajes en español', () => {
    const { ok, errores } = validarFormulario(valido({ nombre: '', telefono: '' }))
    expect(ok).toBe(false)
    expect(errores.nombre).toMatch(/nombre/i)
    expect(errores.telefono).toMatch(/teléfono/i)
  })

  it('rechaza un teléfono mal formado y un email inválido', () => {
    const { errores } = validarFormulario(valido({ telefono: '12345', email: 'no-es-email' }))
    expect(errores.telefono).toBeDefined()
    expect(errores.email).toMatch(/email/i)
  })

  it('rechaza notas de más de 300 caracteres', () => {
    const { errores } = validarFormulario(valido({ notas: 'x'.repeat(301) }))
    expect(errores.notas).toMatch(/300/)
  })

  it('usa las mismas reglas que el servidor (misma fuente)', () => {
    const { valores } = validarFormulario(valido({ nombre: 'Ana‮​', notas: '<b>hola</b>' }))
    expect(valores.nombre).toBe('Ana')
    expect(valores.notas).not.toMatch(/[<>]/)
  })
})

describe('construirPayload', () => {
  const items = [
    { id: 'u1', colorId: 'negro', talla: 'M', cantidad: 2, precioUnitario: 25.9, nombre: 'Falda', imagenes: ['x'] },
    { id: 'u2', colorId: undefined, talla: 'Única', cantidad: 1 },
  ]

  it('envía solo lo que la clienta eligió: ids, color, talla y cantidad', () => {
    const payload = construirPayload({ items, form: valido(), requestId: 'rid', abiertoEn: 1000, ahora: 9000 })
    expect(payload.items).toEqual([
      { id: 'u1', colorId: 'negro', talla: 'M', cantidad: 2 },
      { id: 'u2', colorId: null, talla: 'Única', cantidad: 1 },
    ])
    expect(JSON.stringify(payload)).not.toContain('25.9')
  })

  it('incluye el identificador de la petición, el señuelo vacío y el tiempo transcurrido', () => {
    const payload = construirPayload({ items, form: valido({ empresa: '' }), requestId: 'rid', abiertoEn: 1000, ahora: 9000 })
    expect(payload.request_id).toBe('rid')
    expect(payload.empresa).toBe('')
    expect(payload.elapsed_ms).toBe(8000)
  })

  it('pasa el señuelo tal cual para que el servidor detecte bots', () => {
    const payload = construirPayload({ items, form: valido({ empresa: 'ACME' }), requestId: 'rid', abiertoEn: 0, ahora: 5000 })
    expect(payload.empresa).toBe('ACME')
  })
})

describe('última reserva en sessionStorage', () => {
  beforeEach(() => sessionStorage.clear())

  it('guarda y recupera la reserva', () => {
    guardarUltimaReserva({ numero_ticket: 67 })
    expect(leerUltimaReserva()).toEqual({ numero_ticket: 67 })
  })

  it('devuelve null si no hay nada o si el contenido está corrupto', () => {
    expect(leerUltimaReserva()).toBeNull()
    sessionStorage.setItem('mmj-ultima-reserva', '{roto')
    expect(leerUltimaReserva()).toBeNull()
  })

  it('no guarda reservas sin número de pedido', () => {
    sessionStorage.setItem('mmj-ultima-reserva', JSON.stringify({ otra: 1 }))
    expect(leerUltimaReserva()).toBeNull()
  })
})
