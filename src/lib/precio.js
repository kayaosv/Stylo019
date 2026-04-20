/**
 * Price hierarchy:
 *   precios_talla[talla]  →  precio  (base)
 *   precio_oferta applies as a discount on top when it's lower.
 */

// Base price for a given size (falls back to global precio)
export const getPrecioBase = (producto, talla) => {
  if (talla && producto.precios_talla?.[talla] != null) {
    return Number(producto.precios_talla[talla])
  }
  return Number(producto.precio)
}

// Effective price considering per-size pricing + sale price
export const getPrecioEfectivo = (producto, talla) => {
  const base = getPrecioBase(producto, talla)
  if (producto.precio_oferta != null && Number(producto.precio_oferta) < base) {
    return Number(producto.precio_oferta)
  }
  return base
}

// Split a numeric price into { int, dec } for editorial display
export const formatPrice = (precio) => {
  const safe = Number(precio ?? 0)
  const [int, dec] = safe.toFixed(2).split('.')
  return { int, dec }
}
