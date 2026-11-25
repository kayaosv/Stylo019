import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/services/categorias', () => ({
  fetchCategorias: vi.fn().mockResolvedValue({ data: [{ id: 'faldas', nombre: 'Faldas' }] }),
}))
vi.mock('@gsap/react', () => ({ useGSAP: vi.fn() }))

import { Filtros } from '@/components/catalogo/Filtros'

const props = { filtros: {}, onChange: vi.fn(), onLimpiar: vi.fn(), totalResultados: 3 }

describe('Filtros', () => {
  it('muestra los campos de precio mínimo y máximo y el botón Buscar', () => {
    render(<Filtros {...props} />)
    expect(screen.getByLabelText('Precio minimo')).toBeInTheDocument()
    expect(screen.getByLabelText('Precio maximo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeInTheDocument()
  })

  it('en el panel de escritorio es fijo y con altura limitada a la pantalla', () => {
    render(<Filtros {...props} />)
    const panel = screen.getByLabelText('Filtros de catálogo')
    expect(panel.className).toContain('sticky')
    expect(panel.style.maxHeight).not.toBe('')
  })

  it('dentro del cajón móvil no limita la altura ni crea otro scroll, para que el precio no quede cortado', () => {
    render(<Filtros {...props} enDrawer />)
    const panel = screen.getByLabelText('Filtros de catálogo')
    expect(panel.className).not.toContain('sticky')
    expect(panel.className).not.toContain('overflow-y-auto')
    expect(panel.style.maxHeight).toBe('')
  })
})
