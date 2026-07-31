// Fixed color catalog — kept intentionally small (just the two every
// product tends to have). Everything else is a free/custom color the
// merchant names and picks a hex for per product (see isCustomColor).
// `hex` is used to render the swatch circle in both CMS and product page.
// `border` is applied when the swatch is light enough to need a visible edge.
export const COLORES_DISPONIBLES = [
  { id: 'blanco', label: 'Blanco', hex: '#f5f2ec', border: true },
  { id: 'negro', label: 'Negro', hex: '#1a1a1a', border: false },
]

export const getColorMeta = (id) =>
  COLORES_DISPONIBLES.find((c) => c.id === id) ?? null

// A color entry not in the fixed catalog is valid as long as it carries
// its own label+hex — no longer requires an `id.startsWith('custom-')`
// prefix, since custom colors are now a dynamic list (any id works,
// e.g. a generated UUID) rather than fixed slots. Colors migrated out
// of the fixed catalog (azul/marron/beige/gris, see migration
// 014_colores_libres_backfill.sql) carry their own label+hex now too,
// so they pass this check the same as any other custom color.
const isCustomColor = (c) =>
  c &&
  typeof c.id === 'string' &&
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
