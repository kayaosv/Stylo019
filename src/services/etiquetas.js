import { supabase } from '@/lib/supabase'
import { estaAgotado } from '@/lib/tallas'
import { generarBarcodeUnico } from '@/lib/barcode'

// Stable key for items that don't have a barcode yet (estado 'sin_codigo'),
// where the barcode itself can't be the key. Once a code exists, the code
// itself doubles as the key everywhere else (selection, print, log table).
export const claveDe = (item) => item.barcode ?? `${item.productoId}:${item.colorId ?? 'base'}`

// Un item por color (o uno solo "base" si el producto no usa colores) listo
// para el flujo de impresión — mismo shape que fetchEtiquetasPendientes,
// pero sin filtrar por stock ni por 'activo': se usa para impresión manual
// (botón "Etiqueta" en Productos, buscador de /admin/etiquetas), donde es
// el admin pidiendo explícitamente reimprimir/generar, no un lote automático.
export const itemsDeProducto = (p) => {
  const colores = p.colores ?? []
  if (colores.length === 0) {
    return [{ productoId: p.id, productoNombre: p.nombre, colorId: null, colorLabel: null, barcode: p.barcode ?? null, imagen: p.imagenes?.[0] ?? null }]
  }
  return colores.map((c) => ({
    productoId: p.id,
    productoNombre: p.nombre,
    colorId: c.id,
    colorLabel: c.label ?? c.id,
    barcode: c.barcode ?? null,
    imagen: c.imagenes?.[0] ?? p.imagenes?.[0] ?? null,
  }))
}

/**
 * Búsqueda por nombre para el buscador de /admin/etiquetas. Deliberadamente
 * SIN filtrar por `activo` (a diferencia del buscador del TPV) — un
 * producto inactivo puede tener stock físico real esperando etiqueta, y
 * excluirlo aquí repetiría el mismo punto ciego que ya tiene la lista
 * automática de pendientes.
 */
export const buscarProductosPorNombre = async (termino) => {
  const term = termino.trim()
  if (term.length < 2) return []
  const { data } = await supabase
    .from('productos')
    .select('id, nombre, activo, barcode, colores, imagenes')
    .ilike('nombre', `%${term}%`)
    .limit(8)
  return data ?? []
}

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
      .select('id, nombre, activo, barcode, colores, tallas, imagenes')
      .eq('activo', true),
    supabase.from('etiquetas_impresas').select('barcode'),
  ])

  if (prodErr) return { data: [], error: prodErr }
  if (impErr) return { data: [], error: impErr }

  const impresasSet = new Set((impresas ?? []).map((r) => r.barcode))
  const pendientes = []

  const push = (p, colorId, colorLabel, barcode, tallas, imagen) => {
    if (estaAgotado(tallas)) return // sin stock real -- nada que etiquetar todavia
    if (barcode) {
      if (!impresasSet.has(barcode)) {
        pendientes.push({ estado: 'sin_imprimir', barcode, productoId: p.id, productoNombre: p.nombre, colorId, colorLabel, imagen })
      }
    } else {
      pendientes.push({ estado: 'sin_codigo', barcode: null, productoId: p.id, productoNombre: p.nombre, colorId, colorLabel, imagen })
    }
  }

  for (const p of productos ?? []) {
    const colores = p.colores ?? []
    if (colores.length > 0) {
      for (const c of colores) {
        // Mismo fallback que Producto.jsx/ItemCarrito: foto propia del color
        // si tiene, si no la base del producto -- para no dejar la etiqueta
        // sin ninguna imagen de referencia.
        const imagen = c.imagenes?.[0] ?? p.imagenes?.[0] ?? null
        push(p, c.id, c.label ?? c.id, c.barcode ?? null, c.tallas ?? p.tallas ?? {}, imagen)
      }
    } else {
      push(p, null, null, p.barcode ?? null, p.tallas ?? {}, p.imagenes?.[0] ?? null)
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
