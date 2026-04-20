import { supabase } from '@/lib/supabase'

export const fetchCategorias = async () => {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nombre, orden')
    .eq('activo', true)
    .order('orden')
  return { data: data ?? [], error }
}

export const createCategoria = async (payload) => {
  const { data, error } = await supabase
    .from('categorias')
    .insert(payload)
    .select()
    .single()
  return { data, error }
}

export const updateCategoria = async (id, payload) => {
  const { data, error } = await supabase
    .from('categorias')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export const deleteCategoria = async (id) => {
  const { error } = await supabase.from('categorias').delete().eq('id', id)
  return { error }
}
