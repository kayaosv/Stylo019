import { supabase } from '@/lib/supabase'

const randomDigits = (n) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')

// '20' prefix marks internally-generated codes, distinct from any real
// manufacturer barcode a garment might already carry.
const generateCandidate = () => `20${randomDigits(10)}`

// Checks the candidate against both productos.barcode and every
// colores[].barcode (via the same buscar_por_barcode RPC the TPV scanner
// uses) and retries on collision — mirrors the retry pattern used for
// product barcodes on Vapers Alcosa.
export const generarBarcodeUnico = async () => {
  for (let i = 0; i < 10; i++) {
    const candidate = generateCandidate()
    const { data, error } = await supabase.rpc('buscar_por_barcode', { p_barcode: candidate })
    if (error) throw error
    const hit = Array.isArray(data) ? data[0] : data
    if (!hit?.producto_id) return candidate
  }
  throw new Error('No se pudo generar un código único, inténtalo de nuevo')
}
