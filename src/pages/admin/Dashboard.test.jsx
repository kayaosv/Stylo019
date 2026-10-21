import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@gsap/react', () => ({ useGSAP: vi.fn() }))
vi.mock('gsap', () => ({ default: { registerPlugin: vi.fn(), fromTo: vi.fn(), set: vi.fn(), to: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/services/productos', () => ({ fetchProductosAdmin: vi.fn().mockResolvedValue({ data: [] }) }))
vi.mock('@/services/categorias', () => ({ fetchCategorias: vi.fn().mockResolvedValue({ data: [] }) }))
vi.mock('@/services/etiquetas', () => ({ fetchEtiquetasPendientes: vi.fn().mockResolvedValue({ data: [] }) }))
vi.mock('@/hooks/usePedidosPendientesCount', () => ({ usePedidosPendientesCount: vi.fn() }))
vi.mock('@/hooks/useAdminPedidos', async (importOriginal) => ({
  ...(await importOriginal()),
  useAdminPedidos: vi.fn(),
}))

import { useAdminPedidos } from '@/hooks/useAdminPedidos'
import { usePedidosPendientesCount } from '@/hooks/usePedidosPendientesCount'
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

const abrir = (pedidos, pendientes = 0) => {
  useAdminPedidos.mockReturnValue({ pedidos, loading: false })
  usePedidosPendientesCount.mockReturnValue(pendientes)
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

describe('Dashboard — aviso de pedidos nuevos en el botón Pedidos', () => {
  const botonPedidos = async () => (await screen.findByRole('link', { name: /^Pedidos/ }))

  it('muestra un número rojo en el botón Pedidos cuando hay pedidos pendientes', async () => {
    abrir([pedido()], 3)
    const boton = await botonPedidos()
    expect(boton).toHaveAttribute('href', '/admin/pedidos')
    expect(within(boton).getByLabelText('3 pedidos pendientes')).toHaveTextContent('3')
  })

  it('no muestra nada si no hay pedidos pendientes', async () => {
    abrir([pedido()], 0)
    const boton = await botonPedidos()
    expect(within(boton).queryByLabelText(/pendiente/)).not.toBeInTheDocument()
  })

  it('cuenta también las reservas en tienda, que entran como pendientes', async () => {
    abrir([reserva()], 1)
    const boton = await botonPedidos()
    expect(within(boton).getByLabelText('1 pedido pendiente')).toBeInTheDocument()
  })

  it('el número aparece como burbuja flotante sobre el botón, no al lado del texto', async () => {
    abrir([pedido()], 4)
    const boton = await botonPedidos()
    const burbuja = within(boton).getByLabelText('4 pedidos pendientes')
    expect(getComputedStyle(burbuja).position).toBe('absolute')
    expect(getComputedStyle(boton).position).toBe('relative')
  })

  it('el panel pide refrescar los pedidos solo cada 30 segundos', async () => {
    abrir([pedido()], 0)
    await botonPedidos()
    expect(useAdminPedidos).toHaveBeenCalledWith(expect.objectContaining({ autoRefreshMs: 30000 }))
  })
})
