import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { eq, from } = vi.hoisted(() => {
  const eq = vi.fn()
  const from = vi.fn(() => ({ select: vi.fn(() => ({ eq })) }))
  return { eq, from }
})
vi.mock('@/lib/supabase', () => ({ supabase: { from } }))

import { usePedidosPendientesCount } from '@/hooks/usePedidosPendientesCount'

const ponerPestana = (estado) =>
  Object.defineProperty(document, 'visibilityState', { value: estado, configurable: true })

beforeEach(() => {
  vi.useFakeTimers()
  ponerPestana('visible')
  eq.mockReset()
  from.mockClear()
})

afterEach(() => vi.useRealTimers())

describe('usePedidosPendientesCount', () => {
  it('cuenta los pedidos en estado pendiente al montar', async () => {
    eq.mockResolvedValue({ count: 2, error: null })
    const { result } = renderHook(() => usePedidosPendientesCount())

    await act(async () => {})
    expect(result.current).toBe(2)
    expect(from).toHaveBeenCalledWith('ventas')
    expect(eq).toHaveBeenCalledWith('estado', 'pendiente')
  })

  it('se actualiza solo cada 30 segundos cuando entran pedidos nuevos', async () => {
    eq.mockResolvedValueOnce({ count: 2, error: null }).mockResolvedValueOnce({ count: 5, error: null })
    const { result } = renderHook(() => usePedidosPendientesCount())
    await act(async () => {})
    expect(result.current).toBe(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(result.current).toBe(5)
  })

  it('baja el número cuando se gestionan los pedidos', async () => {
    eq.mockResolvedValueOnce({ count: 3, error: null }).mockResolvedValueOnce({ count: 0, error: null })
    const { result } = renderHook(() => usePedidosPendientesCount())
    await act(async () => {})
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(result.current).toBe(0)
  })

  it('si una consulta falla, conserva el último número en vez de borrarlo', async () => {
    eq.mockResolvedValueOnce({ count: 4, error: null }).mockResolvedValueOnce({ count: null, error: { message: 'x' } })
    const { result } = renderHook(() => usePedidosPendientesCount())
    await act(async () => {})
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(result.current).toBe(4)
  })

  it('no consulta mientras la pestaña está oculta y consulta al volver', async () => {
    eq.mockResolvedValueOnce({ count: 1, error: null }).mockResolvedValueOnce({ count: 6, error: null })
    const { result } = renderHook(() => usePedidosPendientesCount())
    await act(async () => {})

    ponerPestana('hidden')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })
    expect(eq).toHaveBeenCalledTimes(1)

    ponerPestana('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe(6)
  })

  it('al desmontar no actualiza el estado ni sigue consultando', async () => {
    eq.mockResolvedValue({ count: 2, error: null })
    const { unmount } = renderHook(() => usePedidosPendientesCount())
    await act(async () => {})
    unmount()

    await vi.advanceTimersByTimeAsync(120_000)
    expect(eq).toHaveBeenCalledTimes(1)
  })
})
