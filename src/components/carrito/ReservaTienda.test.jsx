import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/services/pedidos', () => ({ crearPedidoRecogida: vi.fn() }))
vi.mock('@/lib/comprobante', async (importOriginal) => ({
  ...(await importOriginal()),
  compartirComprobante: vi.fn(),
  descargarComprobante: vi.fn(),
}))

import { crearPedidoRecogida } from '@/services/pedidos'
import { compartirComprobante, descargarComprobante } from '@/lib/comprobante'
import { useCartStore } from '@/store/useCartStore'
import { ReservaTienda } from '@/components/carrito/ReservaTienda'

const reserva = {
  numero_ticket: 67,
  total: 25.9,
  creado_el: '2026-10-21T10:30:00.000Z',
  expira_el: '2026-10-28T10:30:00.000Z',
  cliente_nombre: 'María José',
  cliente_telefono: '+34638970807',
  lineas: [{ producto_nombre: 'Falda Ibiza', color_label: 'Negro', talla: 'M', cantidad: 1, precio_unitario: 25.9 }],
}

const itemCarrito = {
  id: '3f2b8d1e-6a4c-4b9e-8f10-2c5d7a9b1e34',
  nombre: 'Falda Ibiza',
  talla: 'M',
  colorId: 'negro',
  colorLabel: 'Negro',
  cantidad: 1,
  precioUnitario: 25.9,
  imagenes: ['https://x/foto.png'],
}

const abrir = (props = {}) => {
  const onVolver = vi.fn()
  const onCerrar = vi.fn()
  render(<ReservaTienda onVolver={onVolver} onCerrar={onCerrar} {...props} />)
  return { onVolver, onCerrar, user: userEvent.setup() }
}

const rellenar = async (user, { nombre = 'María José', telefono = '638 970 807', email = '' } = {}) => {
  await user.type(screen.getByLabelText(/^nombre/i), nombre)
  await user.type(screen.getByLabelText(/^teléfono/i), telefono)
  if (email) await user.type(screen.getByLabelText(/^email/i), email)
}

beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  localStorage.clear()
  useCartStore.setState({ items: [itemCarrito] })
  // Pretend the form has been open for a while so the anti-bot wait is skipped.
  const t0 = 1_000_000
  let llamadas = 0
  vi.spyOn(Date, 'now').mockImplementation(() => (llamadas++ === 0 ? t0 : t0 + 20_000))
})

afterEach(() => vi.restoreAllMocks())

describe('ReservaTienda — formulario', () => {
  it('muestra el resumen del carrito, el aviso de pago en tienda y los campos', () => {
    abrir()
    expect(screen.getByText(/Falda Ibiza/)).toBeInTheDocument()
    expect(screen.getByText(/recogida y pago en tienda/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^nombre/i)).toBeRequired()
    expect(screen.getByLabelText(/^teléfono/i)).toBeRequired()
    expect(screen.getByLabelText(/^email/i)).not.toBeRequired()
    expect(screen.getByLabelText(/^notas/i)).not.toBeRequired()
  })

  it('el campo señuelo existe pero no es visible ni accesible ni enfocable', () => {
    abrir()
    const señuelo = document.querySelector('input[name="empresa"]')
    expect(señuelo).toBeInTheDocument()
    expect(señuelo).toHaveAttribute('tabindex', '-1')
    expect(señuelo).toHaveAttribute('autocomplete', 'off')
    expect(señuelo.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('no envía nada y marca los errores si faltan datos', async () => {
    const { user } = abrir()
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
    expect(screen.getByLabelText(/^nombre/i)).toHaveAttribute('aria-invalid', 'true')
    expect(crearPedidoRecogida).not.toHaveBeenCalled()
  })

  it('rechaza un teléfono inválido sin llamar al servidor', async () => {
    const { user } = abrir()
    await rellenar(user, { telefono: '12345' })
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(screen.getByText(/teléfono válido/i)).toBeInTheDocument()
    expect(crearPedidoRecogida).not.toHaveBeenCalled()
  })

  it('el botón Volver regresa al carrito', async () => {
    const { user, onVolver } = abrir()
    await user.click(screen.getByRole('button', { name: /volver/i }))
    expect(onVolver).toHaveBeenCalled()
  })
})

describe('ReservaTienda — envío', () => {
  it('envía solo lo elegido por la clienta y vacía el carrito cuando el servidor confirma', async () => {
    crearPedidoRecogida.mockResolvedValue(reserva)
    const { user } = abrir()
    await rellenar(user, { email: 'maria@example.com' })
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    await screen.findByText(/#67/)
    const payload = crearPedidoRecogida.mock.calls[0][0]
    expect(payload.items).toEqual([{ id: itemCarrito.id, colorId: 'negro', talla: 'M', cantidad: 1 }])
    expect(payload.telefono).toBe('638 970 807')
    expect(payload.email).toBe('maria@example.com')
    expect(payload.empresa).toBe('')
    expect(payload.request_id).toMatch(/^[0-9a-f-]{36}$/)
    expect(JSON.stringify(payload)).not.toContain('25.9')
    expect(useCartStore.getState().items).toEqual([])
  })

  it('un doble clic crea una sola reserva', async () => {
    let resolver
    crearPedidoRecogida.mockImplementation(() => new Promise((r) => (resolver = r)))
    const { user } = abrir()
    await rellenar(user)

    const boton = screen.getByRole('button', { name: /confirmar reserva/i })
    await user.dblClick(boton)
    expect(crearPedidoRecogida).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /enviando/i })).toBeDisabled()

    resolver(reserva)
    await screen.findByText(/#67/)
  })

  it('si el servidor rechaza (por ejemplo, sin stock), muestra el motivo y conserva el carrito', async () => {
    crearPedidoRecogida.mockRejectedValue(new Error('Solo quedan 0 unidades de "Falda Ibiza" talla M'))
    const { user } = abrir()
    await rellenar(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Solo quedan 0 unidades')
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(screen.getByRole('button', { name: /confirmar reserva/i })).toBeEnabled()
  })

  it('tras un error se puede reintentar con la misma clave de petición', async () => {
    crearPedidoRecogida.mockRejectedValueOnce(new Error('fallo')).mockResolvedValueOnce(reserva)
    const { user } = abrir()
    await rellenar(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    await screen.findByText(/#67/)

    const [primera, segunda] = crearPedidoRecogida.mock.calls.map(([p]) => p.request_id)
    expect(primera).toBe(segunda)
  })

  it('espera a que pasen los segundos mínimos antes de enviar (autocompletado rápido)', async () => {
    vi.restoreAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      crearPedidoRecogida.mockResolvedValue(reserva)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<ReservaTienda onVolver={() => {}} onCerrar={() => {}} />)
      await rellenar(user)
      await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

      expect(crearPedidoRecogida).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(3000)
      await waitFor(() => expect(crearPedidoRecogida).toHaveBeenCalledTimes(1))
      expect(crearPedidoRecogida.mock.calls[0][0].elapsed_ms).toBeGreaterThanOrEqual(2500)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('ReservaTienda — confirmación', () => {
  it('muestra el número, el total y la validez, y guarda la reserva para recargas', async () => {
    crearPedidoRecogida.mockResolvedValue(reserva)
    const { user } = abrir()
    await rellenar(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    await screen.findByText(/#67/)
    expect(screen.getByText(/28\/10\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/pendiente de pago/i)).toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem('mmj-ultima-reserva')).numero_ticket).toBe(67)
  })

  it('se puede abrir directamente con una reserva anterior (tras recargar la página)', () => {
    abrir({ pedidoInicial: reserva })
    expect(screen.getByText(/#67/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^nombre/i)).not.toBeInTheDocument()
  })

  it('«Enviar por WhatsApp» comparte el comprobante', async () => {
    compartirComprobante.mockResolvedValue('compartido')
    const { user } = abrir({ pedidoInicial: reserva })
    await user.click(screen.getByRole('button', { name: /whatsapp/i }))
    expect(compartirComprobante).toHaveBeenCalledWith(reserva)
  })

  it('si no se puede generar el comprobante, avisa sin romper la pantalla', async () => {
    compartirComprobante.mockRejectedValue(new Error('No se pudo generar el comprobante'))
    const { user } = abrir({ pedidoInicial: reserva })
    await user.click(screen.getByRole('button', { name: /whatsapp/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/comprobante/i)
    expect(screen.getByText(/#67/)).toBeInTheDocument()
  })

  it('«Descargar comprobante» solo descarga', async () => {
    descargarComprobante.mockResolvedValue(undefined)
    const { user } = abrir({ pedidoInicial: reserva })
    await user.click(screen.getByRole('button', { name: /descargar/i }))
    expect(descargarComprobante).toHaveBeenCalledWith(reserva)
    expect(compartirComprobante).not.toHaveBeenCalled()
  })

  it('«Seguir comprando» cierra el cajón', async () => {
    const { user, onCerrar } = abrir({ pedidoInicial: reserva })
    await user.click(screen.getByRole('button', { name: /seguir comprando/i }))
    expect(onCerrar).toHaveBeenCalled()
  })
})
