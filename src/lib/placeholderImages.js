// Temporary Unsplash placeholders by product category.
// Used until the client uploads real product photography.
// Remove this file and its imports in `services/productos.js` once real images
// live in the `productos.imagenes` column.

const UNSPLASH = (id, w = 1000) =>
  `https://images.unsplash.com/${id}?w=${w}&auto=format&fit=crop&q=80`

const IMAGES_BY_CATEGORIA = {
  vestidos: [
    'photo-1515372039744-b8f02a3ae446',
    'photo-1496747611176-843222e1e57c',
    'photo-1525507119028-ed4c629a60a3',
    'photo-1483985988355-763728e1935b',
  ],
  blazers: [
    'photo-1591047139829-d91aecb6caea',
    'photo-1551232864-3f0890e580d9',
    'photo-1581044777550-4cfa60707c03',
  ],
  abrigos: [
    'photo-1544022613-e87ca75a784a',
    'photo-1520975916090-3105956dac38',
    'photo-1539109136881-3be0616acf4b',
  ],
  faldas: [
    'photo-1572804013309-59a88b7e92f1',
    'photo-1594633312681-425c7b97ccd1',
    'photo-1577900232427-18219b9166a0',
  ],
  pantalones: [
    'photo-1506629082955-511b1aa562c8',
    'photo-1605763240000-7e93b172d754',
    'photo-1509631179647-0177331693ae',
  ],
  blusas: [
    'photo-1490481651871-ab68de25d43d',
    'photo-1583744946564-b52ac1c389c8',
    'photo-1596755094514-f87e34085b2c',
  ],
}

// Deterministic string hash → non-negative int
const hash = (str = '') => {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Pick a stable set of placeholder images for a single product.
// Returns an array of 3 URLs (main + 2 alternates for the gallery).
export const getPlaceholderImages = (producto) => {
  const pool = IMAGES_BY_CATEGORIA[producto?.categoria] || IMAGES_BY_CATEGORIA.vestidos
  const seed = hash(producto?.id ?? producto?.nombre ?? '')
  const start = seed % pool.length
  // Rotate pool starting at `start` so each product gets a unique primary image
  const rotated = [...pool.slice(start), ...pool.slice(0, start)]
  return rotated.map((id) => UNSPLASH(id))
}

// Hero image URL — larger size for above-the-fold editorial use
export const HERO_PLACEHOLDER =
  'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=1400&auto=format&fit=crop&q=85'

// Inject placeholder imagenes on products that have an empty/missing array.
// Falls back to the first color variant image before using Unsplash placeholders.
export const withPlaceholderImages = (producto) => {
  if (!producto) return producto
  const hasReal = Array.isArray(producto.imagenes) && producto.imagenes.length > 0
  if (hasReal) return producto
  const firstColorImage = Array.isArray(producto.colores)
    ? producto.colores[0]?.imagenes?.[0]
    : null
  if (firstColorImage) return { ...producto, imagenes: [firstColorImage] }
  return { ...producto, imagenes: getPlaceholderImages(producto) }
}
