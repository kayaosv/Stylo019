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
})
