import { supabase } from '@/lib/supabase'
import { estaAgotado } from '@/lib/tallas'
import { generarBarcodeUnico } from '@/lib/barcode'

// Stable key for items that don't have a barcode yet (estado 'sin_codigo'),
// where the barcode itself can't be the key. Once a code exists, the code
// itself doubles as the key everywhere else (selection, print, log table).
export const claveDe = (item) => item.barcode ?? `${item.productoId}:${item.colorId ?? 'base'}`

/**
 * Every product/color variant with real stock (stock 0 = nothing physical
 * to label yet, excluded) that either:
 *   - never had a barcode generated at all ('sin_codigo'), or
 *   - has one but it isn't logged in etiquetas_impresas yet ('sin_imprimir')
 *
 * 'sin_imprimir' is compared by the barcode value itself (not a flag on the
 * product) so a regenerated code automatically counts as pending again with
 * no extra reset logic.
 *
 * @returns {Promise<{ data: Array, error: Object|null }>}
 */
export const fetchEtiquetasPendientes = async () => {
  const [{ data: productos, error: prodErr }, { data: impresas, error: impErr }] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, activo, barcode, colores, tallas')
      .eq('activo', true),
    supabase.from('etiquetas_impresas').select('barcode'),
  ])

  if (prodErr) return { data: [], error: prodErr }
  if (impErr) return { data: [], error: impErr }

  const impresasSet = new Set((impresas ?? []).map((r) => r.barcode))
  const pendientes = []

  const push = (p, colorId, colorLabel, barcode, tallas) => {
    if (estaAgotado(tallas)) return // sin stock real -- nada que etiquetar todavia
    if (barcode) {
      if (!impresasSet.has(barcode)) {
        pendientes.push({ estado: 'sin_imprimir', barcode, productoId: p.id, productoNombre: p.nombre, colorId, colorLabel })
      }
    } else {
      pendientes.push({ estado: 'sin_codigo', barcode: null, productoId: p.id, productoNombre: p.nombre, colorId, colorLabel })
    }
  }

  for (const p of productos ?? []) {
    const colores = p.colores ?? []
    if (colores.length > 0) {
      for (const c of colores) {
        push(p, c.id, c.label ?? c.id, c.barcode ?? null, c.tallas ?? p.tallas ?? {})
      }
    } else {
      push(p, null, null, p.barcode ?? null, p.tallas ?? {})
    }
  }

  return { data: pendientes, error: null }
}

/**
 * Generates a real barcode for an item that never had one and persists it
 * (base product column or the matching entry inside colores[]), returning
 * the item with its new code + estado flipped to 'sin_imprimir' so it can
 * go straight into the same print batch.
 */
export const generarYGuardarBarcode = async (item) => {
  const barcode = await generarBarcodeUnico()

  if (item.colorId) {
    const { data: producto, error: fetchErr } = await supabase
      .from('productos')
      .select('colores')
      .eq('id', item.productoId)
      .single()
    if (fetchErr) throw fetchErr

    const nuevoColores = (producto.colores ?? []).map((c) =>
      c.id === item.colorId ? { ...c, barcode } : c
    )
    const { error } = await supabase.from('productos').update({ colores: nuevoColores }).eq('id', item.productoId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('productos').update({ barcode }).eq('id', item.productoId)
    if (error) throw error
  }

  return { ...item, barcode, estado: 'sin_imprimir' }
}

/**
 * Logs a batch of barcodes as printed. Upsert on barcode so re-printing
 * something already logged just refreshes printed_at instead of erroring.
 */
export const marcarEtiquetasImpresas = async (items) => {
  if (!items || items.length === 0) return { error: null }

  const rows = items.map((i) => ({
    barcode: i.barcode,
    producto_id: i.productoId,
    producto_nombre: i.productoNombre,
    color_id: i.colorId,
    color_label: i.colorLabel,
  }))

  const { error } = await supabase.from('etiquetas_impresas').upsert(rows, { onConflict: 'barcode' })
  return { error }
}
