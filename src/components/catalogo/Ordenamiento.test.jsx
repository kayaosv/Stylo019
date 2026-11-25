import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Ordenamiento } from '@/components/catalogo/Ordenamiento'

describe('Ordenamiento', () => {
  it('ofrece Categorías (por defecto) y Novedades como órdenes distintos', () => {
    const onChange = vi.fn()
    render(<Ordenamiento valor="categorias" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Categorías' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Novedades' }))
    expect(onChange).toHaveBeenCalledWith('novedad')
    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }))
    expect(onChange).toHaveBeenCalledWith('categorias')
  })
})
