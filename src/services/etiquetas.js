import { supabase } from '@/lib/supabase'

/**
 * Every barcode that currently exists (base product + per color, active
 * products only) minus every barcode already logged in etiquetas_impresas
 * = still pending to print. Comparing by the barcode value itself (not a
 * flag stored on the product) means a regenerated code automatically
 * counts as pending again with no extra reset logic.
 *
 * @returns {Promise<{ data: Array, error: Object|null }>}
 */
export const fetchEtiquetasPendientes = async () => {
  const [{ data: productos, error: prodErr }, { data: impresas, error: impErr }] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, activo, barcode, colores')
      .eq('activo', true),
    supabase.from('etiquetas_impresas').select('barcode'),
  ])

  if (prodErr) return { data: [], error: prodErr }
  if (impErr) return { data: [], error: impErr }

  const impresasSet = new Set((impresas ?? []).map((r) => r.barcode))
  const pendientes = []

  for (const p of productos ?? []) {
    if (p.barcode && !impresasSet.has(p.barcode)) {
      pendientes.push({
        barcode: p.barcode,
        productoId: p.id,
        productoNombre: p.nombre,
        colorId: null,
        colorLabel: null,
      })
    }
    for (const c of p.colores ?? []) {
      if (c.barcode && !impresasSet.has(c.barcode)) {
        pendientes.push({
          barcode: c.barcode,
          productoId: p.id,
          productoNombre: p.nombre,
          colorId: c.id,
          colorLabel: c.label ?? c.id,
        })
      }
    }
  }

  return { data: pendientes, error: null }
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
