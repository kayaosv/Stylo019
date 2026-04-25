import { supabase } from '@/lib/supabase'
import { withPlaceholderImages } from '@/lib/placeholderImages'
import { extractPathFromPublicUrl } from '@/services/storage'

const POR_PAGINA_DEFAULT = 12

/**
 * Fetch products from Supabase with filters, search, ordering and pagination.
 *
 * @param {Object} params
 * @param {string|null}  params.categoria       - Category filter
 * @param {string|null}  params.tallaDisponible - Size filter (client-side)
 * @param {number|null}  params.precioMin       - Minimum price
 * @param {number|null}  params.precioMax       - Maximum price
 * @param {string|null}  params.busqueda        - Search query (name/description)
 * @param {string}       params.orden           - Sort order
 * @param {number}       params.pagina          - Page number (1-based)
 * @param {number}       params.porPagina       - Items per page
 * @returns {Promise<{ data: Array, count: number, error: Object|null }>}
 */
export const fetchProductos = async ({
  categoria = null,
  tallaDisponible = null,
  precioMin = null,
  precioMax = null,
  busqueda = null,
  orden = 'novedad',
  pagina = 1,
  porPagina = POR_PAGINA_DEFAULT,
} = {}) => {
  let query = supabase
    .from('productos')
    .select('*', { count: 'exact' })

  // Category
  if (categoria) query = query.eq('categoria', categoria.toLowerCase())

  // Talla — server-side via generated column tallas_disponibles (Migration 010)
  if (tallaDisponible) query = query.contains('tallas_disponibles', [tallaDisponible])

  // Price range
  if (precioMin !== null) query = query.gte('precio', precioMin)
  if (precioMax !== null) query = query.lte('precio', precioMax)

  // Full-text search on nombre + descripcion
  if (busqueda && busqueda.trim()) {
    const q = busqueda.trim()
    query = query.or(`nombre.ilike.%${q}%,descripcion.ilike.%${q}%`)
  }

  // Sorting
  switch (orden) {
    case 'precio_asc':
      query = query.order('precio', { ascending: true })
      break
    case 'precio_desc':
      query = query.order('precio', { ascending: false })
      break
    case 'mas_vendidos':
      query = query.eq('mas_vendido', true).order('created_at', { ascending: false })
      break
    case 'novedad':
    default:
      query = query.order('created_at', { ascending: false })
  }

  // Pagination always applies (no client-side filter fallback needed)
  const from = (pagina - 1) * porPagina
  const to = from + porPagina - 1
  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) return { data: [], count: 0, error }

  return {
    data: (data ?? []).map(withPlaceholderImages),
    count: count ?? 0,
    error: null,
  }
}

// Fetch a single product by id (public — applies placeholder images if empty)
export const fetchProductoById = async (id) => {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('id', id)
    .single()

  return { data: data ? withPlaceholderImages(data) : null, error }
}

// Admin fetcher — returns the raw row without injecting placeholder images.
// Use this from the CMS so editing never persists placeholder URLs back to DB.
export const fetchProductoAdmin = async (id) => {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('id', id)
    .single()

  return { data, error }
}

// Fetch up to `limit` products in the same category, excluding the current product
export const fetchProductosRelacionados = async (categoria, excludeId, limit = 4) => {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('categoria', categoria)
    .neq('id', excludeId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data: (data ?? []).map(withPlaceholderImages), error }
}

// ============================================================
// Admin-only queries (require authenticated session + RLS)
// ============================================================

/**
 * Fetch every product (active + inactive) for the admin CMS.
 * No pagination — admin expects to see everything.
 *
 * @param {Object} params
 * @param {string|null} params.categoria
 * @param {string|null} params.busqueda
 * @returns {Promise<{ data: Array, error: Object|null }>}
 */
export const fetchProductosAdmin = async ({
  categoria = null,
  busqueda = null,
} = {}) => {
  let query = supabase
    .from('productos')
    .select('*')
    .order('created_at', { ascending: false })

  if (categoria) query = query.eq('categoria', categoria.toLowerCase())

  if (busqueda && busqueda.trim()) {
    const q = busqueda.trim()
    query = query.or(`nombre.ilike.%${q}%,descripcion.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) return { data: [], error }
  return { data: (data ?? []).map(withPlaceholderImages), error: null }
}

/**
 * Patch a single product by id. Returns the updated row.
 *
 * @param {string} id
 * @param {Object} patch - Partial fields to update
 */
export const updateProducto = async (id, patch) => {
  const { data, error } = await supabase
    .from('productos')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}

/**
 * Insert a new product. Returns the created row with id.
 */
export const createProducto = async (values) => {
  const { data, error } = await supabase
    .from('productos')
    .insert(values)
    .select()
    .single()

  return { data, error }
}

/**
 * Hard delete a product by id.
 *
 * Best-effort cascade to storage: reads the product's imagenes, extracts
 * bucket paths (placeholder URLs are skipped), and removes them before
 * the SQL delete. Storage errors do not block the SQL delete — rare
 * orphan files are acceptable at this scale and preferable to leaving
 * the DB row behind.
 */
export const deleteProducto = async (id) => {
  const { data: row } = await supabase
    .from('productos')
    .select('imagenes, colores')
    .eq('id', id)
    .single()

  const mainPaths = Array.isArray(row?.imagenes)
    ? row.imagenes.map(extractPathFromPublicUrl).filter(Boolean)
    : []

  const colorPaths = Array.isArray(row?.colores)
    ? row.colores.flatMap((c) =>
        Array.isArray(c.imagenes) ? c.imagenes.map(extractPathFromPublicUrl).filter(Boolean) : []
      )
    : []

  const allPaths = [...new Set([...mainPaths, ...colorPaths])]

  if (allPaths.length > 0) {
    await supabase.storage.from('products').remove(allPaths)
  }

  const { error } = await supabase.from('productos').delete().eq('id', id)
  return { error }
}
