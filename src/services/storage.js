import { supabase } from '@/lib/supabase'

const BUCKET = 'products'

/**
 * Return an optimized image URL via Vercel Image Optimization.
 * In dev the raw URL is returned unchanged (/_vercel/image is not available locally).
 * Unsplash placeholders are passed through as-is.
 *
 * @param {string} url     - Original image URL
 * @param {object} opts
 * @param {number} opts.w  - Target width in pixels
 * @param {number} opts.q  - Quality 1-100 (default 80)
 */
export const getOptimizedUrl = (url, { w = 800, q = 80 } = {}) => {
  if (!url) return url
  if (!url.includes('supabase.co')) return url
  if (import.meta.env.DEV) return url
  return `/_vercel/image?url=${encodeURIComponent(url)}&w=${w}&q=${q}`
}
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const ACCEPTED_MIME = /^image\//

// Build a flat unique path: {uuid}.{ext} — ext preserved for Content-Type
const buildObjectPath = (file) => {
  const rawName = file.name || 'image'
  const dot = rawName.lastIndexOf('.')
  const ext = dot >= 0 ? rawName.slice(dot + 1).toLowerCase() : 'jpg'
  const id = crypto.randomUUID()
  return `${id}.${ext}`
}

/**
 * Validate a file before upload.
 * @returns {string|null} Error message, or null if valid.
 */
export const validateImageFile = (file) => {
  if (!file) return 'Archivo inválido.'
  if (!ACCEPTED_MIME.test(file.type)) return 'Sólo se admiten imágenes.'
  if (file.size > MAX_SIZE_BYTES) return 'Máximo 5 MB por imagen.'
  return null
}

/**
 * Upload a single file to the products bucket.
 *
 * @param {File} file
 * @returns {Promise<{ url: string|null, path: string|null, error: string|null }>}
 */
export const uploadProductImage = async (file) => {
  const validationError = validateImageFile(file)
  if (validationError) return { url: null, path: null, error: validationError }

  const path = buildObjectPath(file)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: '31536000',
    })

  if (error) {
    return { url: null, path: null, error: error.message || 'Error al subir la imagen.' }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, path, error: null }
}

/**
 * Delete a single object by storage path.
 * @param {string} path
 */
export const deleteProductImage = async (path) => {
  if (!path) return { error: 'Path vacío.' }
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  return { error: error?.message ?? null }
}

/**
 * Extract the storage path from a Supabase public URL.
 * Supabase public URLs look like:
 *   https://<proj>.supabase.co/storage/v1/object/public/products/<path>
 * (authenticated variant uses /object/authenticated/ instead of /public/)
 *
 * Returns null if the URL doesn't belong to our bucket (e.g. an Unsplash
 * placeholder). Strips any query string and leading slashes so the result
 * can be passed directly to storage.remove().
 */
export const extractPathFromPublicUrl = (url) => {
  if (!url || typeof url !== 'string') return null

  // Try the canonical public path first, then fall back to authenticated.
  const markers = [
    `/storage/v1/object/public/${BUCKET}/`,
    `/storage/v1/object/authenticated/${BUCKET}/`,
    `/storage/v1/object/sign/${BUCKET}/`,
    `/${BUCKET}/`, // last-ditch fallback
  ]

  let rest = null
  for (const marker of markers) {
    const idx = url.indexOf(marker)
    if (idx !== -1) {
      rest = url.slice(idx + marker.length)
      break
    }
  }
  if (!rest) return null

  // Drop query string and fragment if present
  rest = rest.split('?')[0].split('#')[0]
  // Drop accidental leading slash
  rest = rest.replace(/^\/+/, '')

  if (!rest) return null

  try {
    return decodeURIComponent(rest)
  } catch {
    return rest
  }
}
