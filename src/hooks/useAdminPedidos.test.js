import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { order, from } = vi.hoisted(() => {
  const order = vi.fn()
  const from = vi.fn(() => ({ select: vi.fn(() => ({ order })) }))
  return { order, from }
})
vi.mock('@/lib/supabase', () => ({ supabase: { from } }))

import { useAdminPedidos } from '@/hooks/useAdminPedidos'

const pedido = (id, extra = {}) => ({ id, numero_ticket: 1, estado: 'pendiente', ...extra })

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  order.mockReset()
  from.mockClear()
})

afterEach(() => vi.useRealTimers())

describe('useAdminPedidos', () => {
  it('carga los pedidos al montar', async () => {
    order.mockResolvedValue({ data: [pedido('a')], error: null })
    const { result } = renderHook(() => useAdminPedidos())
    expect(result.current.loading).toBe(true)

    await act(async () => {})
    expect(result.current.loading).toBe(false)
    expect(result.current.pedidos).toEqual([pedido('a')])
  })

  it('sin autoRefreshMs no vuelve a consultar solo', async () => {
    order.mockResolvedValue({ data: [pedido('a')], error: null })
    renderHook(() => useAdminPedidos())
    await act(async () => {})

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300_000)
    })
    expect(order).toHaveBeenCalledTimes(1)
  })

  it('con autoRefreshMs trae los pedidos nuevos sin mostrar «cargando» ni parpadear', async () => {
    order
      .mockResolvedValueOnce({ data: [pedido('a')], error: null })
      .mockResolvedValueOnce({ data: [pedido('b'), pedido('a')], error: null })
    const { result } = renderHook(() => useAdminPedidos({ autoRefreshMs: 30_000 }))
    await act(async () => {})

    const estadosDeCarga = []
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
      estadosDeCarga.push(result.current.loading)
    })

    expect(estadosDeCarga).toEqual([false])
    expect(result.current.pedidos.map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('si un refresco automático falla, conserva los pedidos y no muestra error', async () => {
    order
      .mockResolvedValueOnce({ data: [pedido('a')], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'sin red' } })
    const { result } = renderHook(() => useAdminPedidos({ autoRefreshMs: 30_000 }))
    await act(async () => {})

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(result.current.pedidos).toEqual([pedido('a')])
    expect(result.current.error).toBeNull()
  })

  it('un fallo en la primera carga sí se muestra', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'sin red' } })
    const { result } = renderHook(() => useAdminPedidos({ autoRefreshMs: 30_000 }))
    await act(async () => {})

    expect(result.current.error).toEqual({ message: 'sin red' })
    expect(result.current.pedidos).toEqual([])
  })

  it('la recarga manual (refetch) sigue mostrando «cargando»', async () => {
    order.mockResolvedValue({ data: [pedido('a')], error: null })
    const { result } = renderHook(() => useAdminPedidos())
    await act(async () => {})

    let promesa
    act(() => {
      promesa = result.current.refetch()
    })
    expect(result.current.loading).toBe(true)
    await act(async () => {
      await promesa
    })
    expect(result.current.loading).toBe(false)
  })

  it('se puede pausar el refresco (autoRefreshMs null), por ejemplo mientras se edita un pedido', async () => {
    order.mockResolvedValue({ data: [pedido('a')], error: null })
    const { rerender } = renderHook(({ ms }) => useAdminPedidos({ autoRefreshMs: ms }), { initialProps: { ms: 30_000 } })
    await act(async () => {})

    rerender({ ms: null })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })
    expect(order).toHaveBeenCalledTimes(1)
  })
})
