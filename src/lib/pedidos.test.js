import { describe, it, expect } from 'vitest'
import {
  esReserva,
  pendienteDeCobro,
  esVentaCobrada,
  resumenPorCobrar,
  etiquetaCanal,
  mensajeCancelacion,
  enlaceWhatsApp,
  venceEl,
} from '@/lib/pedidos'

const venta = (extra = {}) => ({
  id: 'v1',
  canal: 'web',
  metodo_pago: 'stripe',
  estado: 'pendiente',
  total: 25.9,
  created_at: '2026-10-21T10:30:00.000Z',
  pagado_at: '2026-10-21T10:30:00.000Z',
  cobrado_con: null,
  ...extra,
})
const reserva = (extra = {}) => venta({ metodo_pago: 'recogida', pagado_at: null, ...extra })

describe('estado de cobro', () => {
  it('reconoce una reserva y si está pendiente de cobro', () => {
    expect(esReserva(reserva())).toBe(true)
    expect(esReserva(venta())).toBe(false)
    expect(pendienteDeCobro(reserva())).toBe(true)
  })

  it('una reserva cobrada o cancelada ya no está pendiente de cobro', () => {
    expect(pendienteDeCobro(reserva({ pagado_at: '2026-10-22T09:00:00Z', cobrado_con: 'efectivo' }))).toBe(false)
    expect(pendienteDeCobro(reserva({ estado: 'cancelado' }))).toBe(false)
  })

  it('una venta de Stripe o de mostrador nunca está pendiente de cobro', () => {
    expect(pendienteDeCobro(venta())).toBe(false)
    expect(pendienteDeCobro(venta({ canal: 'tienda', metodo_pago: 'efectivo' }))).toBe(false)
  })

  it('solo cuenta como venta cobrada lo que tiene pagado_at y no está cancelado', () => {
    expect(esVentaCobrada(venta())).toBe(true)
    expect(esVentaCobrada(reserva())).toBe(false)
    expect(esVentaCobrada(venta({ estado: 'cancelado' }))).toBe(false)
    expect(esVentaCobrada(reserva({ pagado_at: '2026-10-22T09:00:00Z' }))).toBe(true)
  })

  it('un registro sin pagado_at no cuenta como cobrado (no se asume nada)', () => {
    const { pagado_at: _omitido, ...sinCampo } = venta()
    expect(esVentaCobrada(sinCampo)).toBe(false)
  })
})

describe('resumenPorCobrar', () => {
  it('suma cantidad e importe solo de las reservas abiertas', () => {
    const pedidos = [
      reserva({ id: 'a', total: 10 }),
      reserva({ id: 'b', total: 15.5 }),
      reserva({ id: 'c', total: 99, estado: 'cancelado' }),
      reserva({ id: 'd', total: 40, pagado_at: '2026-10-22T09:00:00Z' }),
      venta({ id: 'e', total: 500 }),
    ]
    expect(resumenPorCobrar(pedidos)).toEqual({ cantidad: 2, importe: 25.5 })
  })

  it('sin reservas abiertas devuelve ceros', () => {
    expect(resumenPorCobrar([venta()])).toEqual({ cantidad: 0, importe: 0 })
  })
})

describe('etiquetaCanal', () => {
  it('distingue mostrador, Stripe y recogida en tienda', () => {
    expect(etiquetaCanal(venta({ canal: 'tienda', metodo_pago: 'tarjeta' }))).toBe('Mostrador · Tarjeta')
    expect(etiquetaCanal(venta({ canal: 'tienda', metodo_pago: 'efectivo' }))).toBe('Mostrador · Efectivo')
    expect(etiquetaCanal(venta())).toBe('Web · Stripe')
    expect(etiquetaCanal(reserva())).toBe('Web · Recogida en tienda')
  })

  it('una reserva cobrada indica cómo se cobró', () => {
    expect(etiquetaCanal(reserva({ pagado_at: '2026-10-22T09:00:00Z', cobrado_con: 'tarjeta' }))).toBe(
      'Web · Recogida en tienda (cobrado en tarjeta)',
    )
  })
})

describe('mensajeCancelacion', () => {
  it('una reserva sin cobrar no habla de devolver dinero', () => {
    const m = mensajeCancelacion(reserva())
    expect(m).toMatch(/no se ha cobrado/i)
    expect(m).toMatch(/repone el stock/i)
    expect(m).not.toMatch(/reembolso/i)
  })

  it('una reserva ya cobrada avisa de que no se devuelve el dinero solo', () => {
    const m = mensajeCancelacion(reserva({ pagado_at: '2026-10-22T09:00:00Z', cobrado_con: 'efectivo' }))
    expect(m).toMatch(/efectivo/)
    expect(m).toMatch(/NO devuelve el dinero/)
  })

  it('conserva los mensajes existentes de mostrador y Stripe', () => {
    expect(mensajeCancelacion(venta({ canal: 'tienda', metodo_pago: 'tarjeta' }))).toMatch(/mostrador \(tarjeta\)/)
    expect(mensajeCancelacion(venta())).toMatch(/Stripe/)
  })
})

describe('enlaceWhatsApp y venceEl', () => {
  it('construye el enlace solo con dígitos', () => {
    expect(enlaceWhatsApp('+34 638 970 807')).toBe('https://wa.me/34638970807')
    expect(enlaceWhatsApp('+34"><script>')).toBe('https://wa.me/34')
    expect(enlaceWhatsApp(null)).toBe('https://wa.me/')
  })

  it('la reserva vence 7 días después de crearse (igual que el cron)', () => {
    expect(venceEl(reserva()).toISOString()).toBe('2026-10-28T10:30:00.000Z')
  })
})
