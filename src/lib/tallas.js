export const TALLA_SETS = {
  ropa:        ['XS', 'S', 'M', 'L', 'XL'],
  curvy:       ['46', '48', '50', '52', '54', '56', '58'],
  curvy_torso: ['2XL', '3XL', '4XL', '5XL'],
  calzado:     ['35', '36', '37', '38', '39', '40', '41'],
  pantalon:    ['34', '36', '38', '40', '42', '44'],
}

// A product is sold out when every size has zero stock.
// Works for any talla set since it inspects the stock values, not the keys.
export const estaAgotado = (tallas = {}) =>
  !Object.values(tallas ?? {}).some((stock) => Number(stock) > 0)

export const TIPO_TALLA_OPTIONS = [
  { value: 'ropa',        label: 'Ropa (XS–XL)' },
  { value: 'curvy',       label: 'Curvy (46–58)' },
  { value: 'curvy_torso', label: 'Curvy Torso (2XL–5XL)' },
  { value: 'calzado',     label: 'Calzado (35–41)' },
  { value: 'pantalon',    label: 'Pantalón (34–44)' },
]
