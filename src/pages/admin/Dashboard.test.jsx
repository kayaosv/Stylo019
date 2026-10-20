import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@gsap/react', () => ({ useGSAP: vi.fn() }))
vi.mock('gsap', () => ({ default: { registerPlugin: vi.fn(), fromTo: vi.fn(), set: vi.fn(), to: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/services/productos', () => ({ fetchProductosAdmin: vi.fn().mockResolvedValue({ data: [] }) }))
vi.mock('@/services/categorias', () => ({ fetchCategorias: vi.fn().mockResolvedValue({ data: [] }) }))
vi.mock('@/services/etiquetas', () => ({ fetchEtiquetasPendientes: vi.fn().mockResolvedValue({ data: [] }) }))
vi.mock('@/hooks/useAdminPedidos', async (importOriginal) => ({
  ...(await importOriginal()),
  useAdminPedidos: vi.fn(),
}))

import { useAdminPedidos } from '@/hooks/useAdminPedidos'
import Dashboard from '@/pages/admin/Dashboard'

const hoy = new Date().toISOString()

const pedido = (extra = {}) => ({
  id: 'x',
  numero_ticket: 1,
  canal: 'web',
  estado: 'pendiente',
  total: 10,
  metodo_pago: 'stripe',
  created_at: hoy,
  pagado_at: hoy,
  cobrado_con: null,
  cliente_nombre: 'Laura',
  venta_items: [],
  ...extra,
})
const reserva = (extra = {}) =>
  pedido({ id: 'r', numero_ticket: 67, metodo_pago: 'recogida', pagado_at: null, total: 25.9, cliente_nombre: 'María José', ...extra })

const abrir = (pedidos) => {
  useAdminPedidos.mockReturnValue({ pedidos, loading: false })
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('Dashboard — reservas por cobrar', () => {
  it('muestra cuántas reservas hay por cobrar y su importe', async () => {
    abrir([reserva(), reserva({ id: 'r2', numero_ticket: 68, total: 14.1 }), pedido()])
    const tarjeta = (await screen.findByText('Reservas por cobrar')).closest('a, div')
    expect(tarjeta).toHaveTextContent('2 · 40.00 €')
  })

  it('una reserva cancelada o ya cobrada deja de contar como por cobrar', async () => {
    abrir([
      reserva({ id: 'c', estado: 'cancelado' }),
      reserva({ id: 'p', pagado_at: hoy, cobrado_con: 'efectivo' }),
    ])
    const tarjeta = (await screen.findByText('Reservas por cobrar')).closest('a, div')
    expect(tarjeta).toHaveTextContent('0 · 0.00 €')
  })

  it('una reserva sin cobrar no cuenta como venta en el gráfico', async () => {
    abrir([reserva()])
    expect(await screen.findByText(/Aún no hay ventas registradas/)).toBeInTheDocument()
  })

  it('con una venta cobrada y una reserva, el gráfico cuenta solo la venta', async () => {
    abrir([reserva(), pedido()])
    expect(await screen.findByText(/1 pedido\/s/)).toBeInTheDocument()
    expect(screen.queryByText(/2 pedido\/s/)).not.toBeInTheDocument()
  })

  it('la reserva sigue apareciendo en el historial, marcada como por cobrar', async () => {
    abrir([reserva()])
    expect(await screen.findByText(/María José/)).toBeInTheDocument()
    expect(screen.getByText(/· Por cobrar/)).toBeInTheDocument()
  })

  it('una reserva cobrada pasa a contar como venta', async () => {
    abrir([reserva({ pagado_at: hoy, cobrado_con: 'tarjeta' })])
    expect(await screen.findByText(/1 pedido\/s/)).toBeInTheDocument()
  })
})
