import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PedidosBadge } from '@/components/admin/PedidosBadge'

describe('PedidosBadge', () => {
  it('no se muestra si no hay pedidos pendientes', () => {
    const { container } = render(<PedidosBadge count={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra el número en rojo cuando hay pedidos pendientes', () => {
    render(<PedidosBadge count={5} />)
    const badge = screen.getByText('5')
    expect(badge).toBeInTheDocument()
    expect(getComputedStyle(badge).backgroundColor).toBe('rgb(239, 68, 68)')
  })

  it('limita a 99+ para no desbordar el botón', () => {
    render(<PedidosBadge count={120} />)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('anuncia a los lectores de pantalla cuántos pedidos esperan', () => {
    render(<PedidosBadge count={1} />)
    expect(screen.getByLabelText('1 pedido pendiente')).toBeInTheDocument()
    render(<PedidosBadge count={3} />)
    expect(screen.getByLabelText('3 pedidos pendientes')).toBeInTheDocument()
  })

  it('por defecto va en línea, al lado del texto', () => {
    render(<PedidosBadge count={2} />)
    expect(getComputedStyle(screen.getByText('2')).position).not.toBe('absolute')
  })

  it('en modo flotante se coloca como burbuja en la esquina superior derecha del botón', () => {
    render(<PedidosBadge count={2} flotante />)
    const burbuja = screen.getByText('2')
    const estilo = getComputedStyle(burbuja)
    expect(estilo.position).toBe('absolute')
    expect(parseFloat(estilo.top)).toBeLessThan(0)
    expect(parseFloat(estilo.right)).toBeLessThan(0)
    expect(estilo.pointerEvents).toBe('none')
  })

  it('la burbuja flotante lleva un aro del color del fondo (CSS válido) para separarse del botón', () => {
    render(<PedidosBadge count={2} flotante />)
    expect(screen.getByText('2').style.boxShadow).toBe('0 0 0 2px var(--color-base)')
  })
})
