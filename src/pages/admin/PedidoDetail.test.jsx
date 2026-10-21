import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('@gsap/react', () => ({ useGSAP: vi.fn() }))
vi.mock('gsap', () => ({ default: { registerPlugin: vi.fn(), fromTo: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/services/pedidos', () => ({ marcarPedidoCobrado: vi.fn() }))
vi.mock('@/hooks/useAdminPedidos', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchPedidoById: vi.fn(),
  updatePedidoEstado: vi.fn(),
}))

import { fetchPedidoById, updatePedidoEstado } from '@/hooks/useAdminPedidos'
import { marcarPedidoCobrado } from '@/services/pedidos'
import PedidoDetail from '@/pages/admin/PedidoDetail'

const base = (extra = {}) => ({
  id: 'v1',
  numero_ticket: 67,
  canal: 'web',
  estado: 'pendiente',
  total: 25.9,
  metodo_pago: 'recogida',
  created_at: '2026-10-21T10:30:00.000Z',
  notas: null,
  pagado_at: null,
  cobrado_con: null,
  cliente_nombre: 'María José',
  cliente_email: 'maria@example.com',
  cliente_telefono: '+34638970807',
  cliente_direccion: null,
  odoo_sync_status: 'pending',
  odoo_invoice_id: null,
  odoo_sync_error: null,
  venta_items: [
    { id: 'i1', producto_id: 'p1', producto_nombre: 'Falda Ibiza', color_label: 'Negro', talla: 'M', cantidad: 1, precio_unitario: 25.9, precio_original: null },
  ],
  ...extra,
})

const abrir = () =>
  render(
    <MemoryRouter initialEntries={['/admin/pedidos/v1']}>
      <Routes>
        <Route path="/admin/pedidos/:id" element={<PedidoDetail />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

describe('PedidoDetail — reserva pendiente de cobro', () => {
  it('avisa de que está pendiente de cobro y ofrece cobrar en efectivo o tarjeta', async () => {
    fetchPedidoById.mockResolvedValue(base())
    abrir()

    expect(await screen.findByText(/recogida y pago en tienda\. stock reservado hasta el 28 de octubre de 2026/i)).toBeInTheDocument()
    expect(screen.getByText('Pendiente de cobro')).toBeInTheDocument()
    expect(screen.getByText(/Web · Recogida en tienda/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cobrado en efectivo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cobrado en tarjeta/i })).toBeInTheDocument()
    expect(screen.queryByText('Factura Odoo')).not.toBeInTheDocument()
  })

  it('enlaza al WhatsApp de la clienta', async () => {
    fetchPedidoById.mockResolvedValue(base())
    abrir()

    const enlace = await screen.findByRole('link', { name: /escribir por whatsapp/i })
    expect(enlace).toHaveAttribute('href', 'https://wa.me/34638970807')
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('pide confirmación, cobra con el método elegido y recarga el pedido', async () => {
    fetchPedidoById
      .mockResolvedValueOnce(base())
      .mockResolvedValueOnce(base({ pagado_at: '2026-10-22T09:00:00.000Z', cobrado_con: 'efectivo' }))
    marcarPedidoCobrado.mockResolvedValue(undefined)
    const user = userEvent.setup()
    abrir()

    await user.click(await screen.findByRole('button', { name: /cobrado en efectivo/i }))
    expect(screen.getByText(/has cobrado 25\.90 € en efectivo/i)).toBeInTheDocument()
    expect(marcarPedidoCobrado).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /sí, cobrado/i }))

    await waitFor(() => expect(marcarPedidoCobrado).toHaveBeenCalledWith('v1', 'efectivo'))
    expect(await screen.findByText(/cobrado el .* en efectivo/i)).toBeInTheDocument()
    expect(screen.queryByText('Pendiente de cobro')).not.toBeInTheDocument()
  })

  it('si se vuelve atrás en la confirmación, no cobra nada', async () => {
    fetchPedidoById.mockResolvedValue(base())
    const user = userEvent.setup()
    abrir()

    await user.click(await screen.findByRole('button', { name: /cobrado en tarjeta/i }))
    await user.click(screen.getByRole('button', { name: /volver/i }))

    expect(marcarPedidoCobrado).not.toHaveBeenCalled()
    expect(screen.queryByText(/has cobrado/i)).not.toBeInTheDocument()
  })

  it('si la base de datos rechaza el cobro, lo dice y deja la reserva como estaba', async () => {
    fetchPedidoById.mockResolvedValue(base())
    marcarPedidoCobrado.mockRejectedValue(new Error('La reserva ya está cobrada'))
    const user = userEvent.setup()
    abrir()

    await user.click(await screen.findByRole('button', { name: /cobrado en efectivo/i }))
    await user.click(screen.getByRole('button', { name: /sí, cobrado/i }))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('La reserva ya está cobrada')))
    expect(screen.getByText('Pendiente de cobro')).toBeInTheDocument()
  })

  it('al cancelar una reserva sin cobrar explica que no hay dinero que devolver', async () => {
    fetchPedidoById.mockResolvedValue(base())
    updatePedidoEstado.mockResolvedValue(undefined)
    const user = userEvent.setup()
    abrir()

    await user.selectOptions(await screen.findByRole('combobox'), 'cancelado')

    expect(screen.getByText(/todavía no se ha cobrado, así que no hay dinero que devolver/i)).toBeInTheDocument()
  })
})

describe('PedidoDetail — otros casos', () => {
  it('una venta de Stripe no muestra aviso de cobro y conserva la sección de Odoo', async () => {
    fetchPedidoById.mockResolvedValue(
      base({ metodo_pago: 'stripe', pagado_at: '2026-10-21T10:30:00.000Z' }),
    )
    abrir()

    expect(await screen.findByText(/Web · Stripe/)).toBeInTheDocument()
    expect(screen.queryByText('Pendiente de cobro')).not.toBeInTheDocument()
    expect(screen.getByText('Factura Odoo')).toBeInTheDocument()
  })

  it('muestra como texto cualquier dato del cliente: nunca se interpreta como HTML', async () => {
    const hostil = '<img src=x onerror=alert(1)>'
    fetchPedidoById.mockResolvedValue(base({ cliente_nombre: hostil, notas: hostil, cliente_email: null }))
    const { container } = abrir()

    expect(await screen.findAllByText(hostil)).not.toHaveLength(0)
    expect(container.querySelector('img')).toBeNull()
  })
})
