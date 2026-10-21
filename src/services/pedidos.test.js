import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() }, rpc: vi.fn() },
}))

import { supabase } from '@/lib/supabase'
import { crearPedidoRecogida, marcarPedidoCobrado } from '@/services/pedidos'

const respuesta = { numero_ticket: 67, total: 25.9, lineas: [] }

beforeEach(() => vi.resetAllMocks())

describe('crearPedidoRecogida', () => {
  it('invoca la edge function con el cuerpo y devuelve la reserva', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: respuesta, error: null })
    const payload = { nombre: 'Ana' }

    await expect(crearPedidoRecogida(payload)).resolves.toEqual(respuesta)
    expect(supabase.functions.invoke).toHaveBeenCalledWith('crear-pedido-recogida', { body: payload })
  })

  it('muestra el motivo real que devuelve el servidor (por ejemplo, falta de stock)', async () => {
    const context = { json: vi.fn().mockResolvedValue({ error: 'Solo quedan 1 unidades de "Falda"' }) }
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context },
    })

    await expect(crearPedidoRecogida({})).rejects.toThrow('Solo quedan 1 unidades de "Falda"')
  })

  it('si el error no trae JSON, usa un mensaje claro en vez del genérico del cliente', async () => {
    const context = { json: vi.fn().mockRejectedValue(new Error('no json')) }
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context },
    })

    await expect(crearPedidoRecogida({})).rejects.toThrow('No se pudo crear la reserva')
  })

  it('rechaza una respuesta sin número de pedido', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { algo: 1 }, error: null })
    await expect(crearPedidoRecogida({})).rejects.toThrow('No se pudo crear la reserva')
  })
})

describe('marcarPedidoCobrado', () => {
  it('llama a la RPC con el método real de cobro', async () => {
    supabase.rpc.mockResolvedValue({ error: null })
    await marcarPedidoCobrado('abc', 'tarjeta')
    expect(supabase.rpc).toHaveBeenCalledWith('marcar_pedido_cobrado', { p_venta_id: 'abc', p_metodo: 'tarjeta' })
  })

  it('propaga el mensaje de la base de datos si falla', async () => {
    supabase.rpc.mockResolvedValue({ error: { message: 'La reserva ya está cobrada' } })
    await expect(marcarPedidoCobrado('abc', 'efectivo')).rejects.toThrow('La reserva ya está cobrada')
  })
})
