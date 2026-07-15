// Available color variants for product color selection.
// `hex` is used to render the swatch circle in both CMS and product page.
// `border` is applied when the swatch is light enough to need a visible edge.
export const COLORES_DISPONIBLES = [
  { id: 'blanco', label: 'Blanco', hex: '#f5f2ec', border: true },
  { id: 'negro', label: 'Negro', hex: '#1a1a1a', border: false },
  { id: 'azul', label: 'Azul', hex: '#2b4a7a', border: false },
  { id: 'marron', label: 'Marrón', hex: '#6b4423', border: false },
  { id: 'beige', label: 'Beige', hex: '#d9c9a8', border: true },
  { id: 'gris', label: 'Gris', hex: '#8a8a8a', border: false },
]

export const getColorMeta = (id) =>
  COLORES_DISPONIBLES.find((c) => c.id === id) ?? null

// Returns true for custom color entries (id: 'custom-1' | 'custom-2')
const isCustomColor = (c) =>
  c &&
  typeof c.id === 'string' &&
  c.id.startsWith('custom-') &&
  typeof c.hex === 'string' &&
  c.hex.startsWith('#') &&
  typeof c.label === 'string' &&
  c.label.trim().length > 0

// Normalize raw DB value into a full display-ready array.
// Accepts both fixed catalog colors and custom colors (id: custom-*).
// Returns: { id, label, hex, border, imagenes, tallas } for all entries.
// `tallas` is null unless this color carries its own per-size stock map —
// products that don't use per-color stock keep it null and fall back to the
// product's own `tallas`.
// Drops entries with unknown ids, no images, or invalid custom data.
export const normalizeColores = (raw) => {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((c) => {
      if (!c || typeof c.id !== 'string') return false
      return getColorMeta(c.id) !== null || isCustomColor(c)
    })
    .map((c) => {
      const fixed = getColorMeta(c.id)
      return {
        id: c.id,
        label: fixed?.label ?? c.label ?? c.id,
        hex: fixed?.hex ?? c.hex ?? '#cccccc',
        border: fixed?.border ?? c.border ?? false,
        imagenes: Array.isArray(c.imagenes) ? c.imagenes.filter(Boolean) : [],
        tallas: c.tallas && typeof c.tallas === 'object' ? c.tallas : null,
      }
    })
    .filter((c) => c.imagenes.length > 0)
}
