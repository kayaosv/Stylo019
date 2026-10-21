import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'

const ponerPestana = (estado) =>
  Object.defineProperty(document, 'visibilityState', { value: estado, configurable: true })

beforeEach(() => {
  vi.useFakeTimers()
  ponerPestana('visible')
})

afterEach(() => {
  vi.useRealTimers()
  ponerPestana('visible')
})

describe('useAutoRefresh', () => {
  it('llama cada intervalo y no al montar', () => {
    const cb = vi.fn()
    renderHook(() => useAutoRefresh(cb, 30_000))

    expect(cb).not.toHaveBeenCalled()
    vi.advanceTimersByTime(30_000)
    expect(cb).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60_000)
    expect(cb).toHaveBeenCalledTimes(3)
  })

  it('no llama mientras la pestaña está oculta', () => {
    const cb = vi.fn()
    renderHook(() => useAutoRefresh(cb, 30_000))

    ponerPestana('hidden')
    vi.advanceTimersByTime(120_000)
    expect(cb).not.toHaveBeenCalled()
  })

  it('al volver a la pestaña refresca enseguida, sin esperar al siguiente intervalo', () => {
    const cb = vi.fn()
    renderHook(() => useAutoRefresh(cb, 30_000))

    ponerPestana('hidden')
    vi.advanceTimersByTime(90_000)
    ponerPestana('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('al enfocar la ventana también refresca', () => {
    const cb = vi.fn()
    renderHook(() => useAutoRefresh(cb, 30_000))

    window.dispatchEvent(new Event('focus'))
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('visibilitychange y focus seguidos solo llaman una vez', () => {
    const cb = vi.fn()
    renderHook(() => useAutoRefresh(cb, 30_000))

    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
    expect(cb).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(2_000)
    window.dispatchEvent(new Event('focus'))
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('con ms null (o 0) está apagado', () => {
    const cb = vi.fn()
    renderHook(() => useAutoRefresh(cb, null))

    vi.advanceTimersByTime(300_000)
    window.dispatchEvent(new Event('focus'))
    expect(cb).not.toHaveBeenCalled()
  })

  it('al desmontar deja de llamar y quita los listeners', () => {
    const cb = vi.fn()
    const { unmount } = renderHook(() => useAutoRefresh(cb, 30_000))

    unmount()
    vi.advanceTimersByTime(120_000)
    window.dispatchEvent(new Event('focus'))
    expect(cb).not.toHaveBeenCalled()
  })

  it('usa siempre la última versión del callback sin reiniciar el temporizador', () => {
    const primero = vi.fn()
    const segundo = vi.fn()
    const { rerender } = renderHook(({ cb }) => useAutoRefresh(cb, 30_000), { initialProps: { cb: primero } })

    vi.advanceTimersByTime(20_000)
    rerender({ cb: segundo })
    vi.advanceTimersByTime(10_000)

    expect(primero).not.toHaveBeenCalled()
    expect(segundo).toHaveBeenCalledTimes(1)
  })

  it('se puede apagar y volver a encender cambiando el intervalo', () => {
    const cb = vi.fn()
    const { rerender } = renderHook(({ ms }) => useAutoRefresh(cb, ms), { initialProps: { ms: 30_000 } })

    rerender({ ms: null })
    vi.advanceTimersByTime(60_000)
    expect(cb).not.toHaveBeenCalled()

    rerender({ ms: 30_000 })
    vi.advanceTimersByTime(30_000)
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
