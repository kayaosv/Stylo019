import { describe, it, expect, vi, beforeEach } from 'vitest'

// Query builder that records every call so the tests can assert table, filters and order.
const construir = () => {
  const llamadas = []
  const b = {
    llamadas,
    then: (res) => res({ data: [], count: 0, error: null }),
  }
  for (const m of ['select', 'eq', 'contains', 'gte', 'lte', 'or', 'order', 'range']) {
    b[m] = (...args) => {
      llamadas.push([m, ...args])
      return b
    }
  }
  return b
}

let builder
let tabla
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (t) => {
      tabla = t
      builder = construir()
      return builder
    },
  },
}))

import { fetchProductos } from '@/services/productos'

const ordenes = () =>
  builder.llamadas.filter(([m]) => m === 'order').map(([, col, opt]) => [col, opt?.ascending])

beforeEach(() => {
  builder = null
  tabla = null
})

describe('fetchProductos — orden por defecto: el de las categorías del admin', () => {
  it('lee de la vista del catálogo (categorías activas y su orden)', async () => {
    await fetchProductos()
    expect(tabla).toBe('productos_catalogo')
  })

  it('sin orden explícito ordena por orden de categoría y, dentro, el más nuevo primero', async () => {
    await fetchProductos()
    expect(ordenes()).toEqual([
      ['categoria_orden', true],
      ['created_at', false],
      ['id', true],
    ])
  })

  it('el valor "categorias" y un valor desconocido dan el mismo orden', async () => {
    await fetchProductos({ orden: 'categorias' })
    const a = ordenes()
    await fetchProductos({ orden: 'inventado' })
    expect(ordenes()).toEqual(a)
  })

  it('filtrar por una categoría concreta mantiene el más nuevo primero', async () => {
    await fetchProductos({ categoria: 'Faldas' })
    expect(builder.llamadas).toContainEqual(['eq', 'categoria', 'faldas'])
    expect(ordenes()[1]).toEqual(['created_at', false])
  })
})

describe('fetchProductos — Novedades: los últimos añadidos de cada categoría', () => {
  it('ordena por posición dentro de su categoría y luego por orden de categoría', async () => {
    await fetchProductos({ orden: 'novedad' })
    expect(ordenes()).toEqual([
      ['posicion_en_categoria', true],
      ['categoria_orden', true],
      ['id', true],
    ])
  })
})

describe('fetchProductos — otros órdenes no cambian', () => {
  it('precio ascendente', async () => {
    await fetchProductos({ orden: 'precio_asc' })
    expect(ordenes()).toEqual([['precio', true]])
  })

  it('precio descendente', async () => {
    await fetchProductos({ orden: 'precio_desc' })
    expect(ordenes()).toEqual([['precio', false]])
  })

  it('más vendidos filtra por mas_vendido y ordena por fecha', async () => {
    await fetchProductos({ orden: 'mas_vendidos' })
    expect(builder.llamadas).toContainEqual(['eq', 'mas_vendido', true])
    expect(ordenes()).toEqual([['created_at', false]])
  })
})

describe('fetchProductos — paginación', () => {
  it('pide páginas contiguas con range', async () => {
    await fetchProductos({ pagina: 1, porPagina: 12 })
    expect(builder.llamadas).toContainEqual(['range', 0, 11])
    await fetchProductos({ pagina: 3, porPagina: 12 })
    expect(builder.llamadas).toContainEqual(['range', 24, 35])
  })
})
