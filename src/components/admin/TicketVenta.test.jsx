import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TicketVenta } from '@/components/admin/TicketVenta'

const venta = {
  numeroTicket: 84,
  createdAt: new Date('2026-11-25T10:00:00Z'),
  total: 29.9,
  metodoPago: 'efectivo',
  items: [{ key: 'a', cantidad: 1, productoNombre: 'Falda', talla: 'M', precioUnitario: 29.9 }],
}

describe('TicketVenta — logo', () => {
  it('usa el logo térmico en blanco y negro a 54 mm (432 puntos a 8 puntos/mm)', () => {
    render(<TicketVenta venta={venta} onNuevaVenta={() => {}} />)
    const logo = screen.getByAltText('Stylo019')
    expect(logo).toHaveAttribute('src', '/logo-ticket-termica.png')
    expect(logo.style.width).toBe('54mm')
  })

  it('fuerza el negro exacto al imprimir', () => {
    const { container } = render(<TicketVenta venta={venta} onNuevaVenta={() => {}} />)
    expect(container.querySelector('style').textContent).toMatch(/print-color-adjust:\s*exact/)
  })
})
