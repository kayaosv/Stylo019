import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export const VENTA_ESTADOS = ['pendiente', 'preparando', 'listo', 'entregado', 'cancelado']

export const ESTADO_META = {
  pendiente: { label: 'Pendiente', color: '#f59e0b' },
  preparando: { label: 'Preparando', color: '#3b82f6' },
  listo: { label: 'Listo para enviar', color: '#06b6d4' },
  entregado: { label: 'Entregado', color: '#22c55e' },
  cancelado: { label: 'Cancelado', color: '#ef4444' },
}

const LIST_SELECT = `
  id, numero_ticket, canal, estado, total, metodo_pago, created_at,
  cliente_nombre, cliente_email, odoo_sync_status,
  venta_items(id)
`

const DETAIL_SELECT = `
  id, numero_ticket, canal, estado, total, metodo_pago, created_at, notas,
  cliente_nombre, cliente_email, cliente_telefono, cliente_direccion,
  odoo_sync_status, odoo_invoice_id, odoo_sync_error,
  venta_items(id, producto_id, producto_nombre, color_label, talla, cantidad, precio_unitario)
`

export const useAdminPedidos = () => {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('ventas')
      .select(LIST_SELECT)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err)
      setPedidos([])
    } else {
      setPedidos(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { pedidos, loading, error, refetch: fetchAll, setPedidos }
}

export const fetchPedidoById = async (id) => {
  const { data, error } = await supabase
    .from('ventas')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

// Cancelar repone stock via cancelar_venta() (RPC atómica) — cualquier
// otro cambio de estado es un simple update, no toca inventario (el
// stock ya se descontó al confirmar el pago / al cerrar la venta física).
export const updatePedidoEstado = async (id, estado) => {
  if (estado === 'cancelado') {
    const { error } = await supabase.rpc('cancelar_venta', { p_venta_id: id })
    if (error) throw error
    return
  }
  const { error } = await supabase.from('ventas').update({ estado }).eq('id', id)
  if (error) throw error
}
