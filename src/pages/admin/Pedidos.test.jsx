import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@gsap/react', () => ({ useGSAP: vi.fn() }))
vi.mock('gsap', () => ({ default: { registerPlugin: vi.fn(), fromTo: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/hooks/useAdminPedidos', async (importOriginal) => ({
  ...(await importOriginal()),
  useAdminPedidos: vi.fn(),
  updatePedidoEstado: vi.fn(),
}))

import { useAdminPedidos } from '@/hooks/useAdminPedidos'
import Pedidos from '@/pages/admin/Pedidos'

const pedido = (extra = {}) => ({
  id: 'x',
  numero_ticket: 1,
  canal: 'web',
  estado: 'pendiente',
  total: 10,
  metodo_pago: 'stripe',
  created_at: '2026-10-21T10:30:00.000Z',
  pagado_at: '2026-10-21T10:30:00.000Z',
  cobrado_con: null,
  cliente_nombre: 'Cliente',
  cliente_email: null,
  cliente_telefono: null,
  odoo_sync_status: 'pending',
  venta_items: [],
  ...extra,
})

const reserva = pedido({
  id: 'r1',
  numero_ticket: 67,
  metodo_pago: 'recogida',
  pagado_at: null,
  cliente_nombre: 'María José',
  cliente_telefono: '+34638970807',
})
const stripe = pedido({ id: 's1', numero_ticket: 5, cliente_nombre: 'Laura' })
const mostrador = pedido({ id: 't1', numero_ticket: 6, canal: 'tienda', metodo_pago: 'tarjeta', cliente_nombre: null })

const abrir = (pedidos) => {
  useAdminPedidos.mockReturnValue({ pedidos, loading: false, setPedidos: vi.fn() })
  render(
    <MemoryRouter>
      <Pedidos />
    </MemoryRouter>,
  )
  return userEvent.setup()
}

const fila = (texto) => screen.getByText(texto).closest('tr')

beforeEach(() => vi.resetAllMocks())

describe('Pedidos — lista', () => {
  it('marca solo las reservas sin cobrar como «Pendiente de cobro»', () => {
    abrir([reserva, stripe, mostrador])

    expect(within(fila('María José')).getByText('Pendiente de cobro')).toBeInTheDocument()
    expect(within(fila('María José')).getByText('Web · Recogida en tienda')).toBeInTheDocument()
    expect(within(fila('Laura')).queryByText('Pendiente de cobro')).not.toBeInTheDocument()
    expect(within(fila('Laura')).getByText('Web · Stripe')).toBeInTheDocument()
    expect(screen.getByText('Mostrador · Tarjeta')).toBeInTheDocument()
  })

  it('una reserva ya cobrada deja de aparecer como pendiente y dice cómo se cobró', () => {
    abrir([{ ...reserva, pagado_at: '2026-10-22T09:00:00.000Z', cobrado_con: 'tarjeta' }])
    expect(screen.queryByText('Pendiente de cobro')).not.toBeInTheDocument()
    expect(screen.getByText('Web · Recogida en tienda (cobrado en tarjeta)')).toBeInTheDocument()
  })

  it('busca por teléfono a partir de 6 dígitos', async () => {
    const user = abrir([reserva, stripe])
    await user.type(screen.getByPlaceholderText(/buscar/i), '638 970')

    expect(screen.getByText('María José')).toBeInTheDocument()
    expect(screen.queryByText('Laura')).not.toBeInTheDocument()
  })

  it('un número corto se trata como ticket y no como teléfono', async () => {
    const user = abrir([reserva, stripe])
    await user.type(screen.getByPlaceholderText(/buscar/i), '67')

    expect(screen.getByText('María José')).toBeInTheDocument()
    expect(screen.queryByText('Laura')).not.toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText(/buscar/i))
    await user.type(screen.getByPlaceholderText(/buscar/i), '38')
    expect(screen.queryByText('María José')).not.toBeInTheDocument()
  })

  it('el nombre del cliente se muestra como texto, nunca como HTML', () => {
    const hostil = '<img src=x onerror=alert(1)>'
    abrir([{ ...reserva, cliente_nombre: hostil }])

    expect(screen.getByText(hostil)).toBeInTheDocument()
    expect(document.querySelector('td img')).toBeNull()
  })
})
