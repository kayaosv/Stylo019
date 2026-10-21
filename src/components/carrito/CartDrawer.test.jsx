import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@gsap/react', () => ({ useGSAP: vi.fn() }))
vi.mock('gsap', () => ({ default: { registerPlugin: vi.fn() } }))
vi.mock('@/services/settings', () => ({ fetchSetting: vi.fn().mockResolvedValue({ data: 50 }) }))
vi.mock('@/services/stripe', () => ({ createCheckoutSession: vi.fn() }))
vi.mock('@/services/pedidos', () => ({ crearPedidoRecogida: vi.fn() }))

import { CartDrawer } from '@/components/carrito/CartDrawer'
import { useCartStore } from '@/store/useCartStore'
import { useUIStore } from '@/store/useUIStore'

const item = {
  id: '3f2b8d1e-6a4c-4b9e-8f10-2c5d7a9b1e34',
  nombre: 'Falda Ibiza',
  talla: 'M',
  colorId: null,
  colorLabel: null,
  cantidad: 1,
  precioUnitario: 25.9,
  imagenes: [],
}

const reserva = {
  numero_ticket: 67,
  total: 25.9,
  creado_el: '2026-10-21T10:30:00.000Z',
  expira_el: '2026-10-28T10:30:00.000Z',
  cliente_nombre: 'María José',
  cliente_telefono: '+34638970807',
  lineas: [{ producto_nombre: 'Falda Ibiza', color_label: null, talla: 'M', cantidad: 1, precio_unitario: 25.9 }],
}

const abrirCajon = () =>
  render(
    <MemoryRouter>
      <CartDrawer />
    </MemoryRouter>,
  )

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  useCartStore.setState({ items: [item] })
  useUIStore.setState({ cartOpen: true })
})

describe('CartDrawer — reserva en tienda', () => {
  it('ofrece las tres formas de terminar la compra', () => {
    abrirCajon()
    expect(screen.getByRole('button', { name: /pagar con tarjeta/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reservar y pagar en tienda/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /finalizar por whatsapp/i })).toBeInTheDocument()
  })

  it('«Reservar y pagar en tienda» abre el formulario y «Volver» regresa al carrito', async () => {
    const user = userEvent.setup()
    abrirCajon()

    await user.click(screen.getByRole('button', { name: /reservar y pagar en tienda/i }))
    expect(screen.getByRole('button', { name: /confirmar reserva/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /volver/i }))
    expect(screen.queryByRole('button', { name: /confirmar reserva/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pagar con tarjeta/i })).toBeInTheDocument()
  })

  it('el enlace de WhatsApp existente usa el número único de la tienda', () => {
    abrirCajon()
    const enlace = screen.getByRole('link', { name: /finalizar por whatsapp/i })
    expect(enlace.getAttribute('href').startsWith('https://wa.me/34638970807?text=')).toBe(true)
  })

  it('con el carrito vacío no ofrece reservar', () => {
    useCartStore.setState({ items: [] })
    abrirCajon()
    expect(screen.queryByRole('button', { name: /reservar y pagar en tienda/i })).not.toBeInTheDocument()
  })

  it('con el carrito vacío y una reserva reciente, permite volver a ver su comprobante', async () => {
    useCartStore.setState({ items: [] })
    sessionStorage.setItem('mmj-ultima-reserva', JSON.stringify(reserva))
    const user = userEvent.setup()
    abrirCajon()

    await user.click(screen.getByRole('button', { name: /comprobante de tu última reserva/i }))
    expect(screen.getByText(/#67/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeInTheDocument()
  })
})
