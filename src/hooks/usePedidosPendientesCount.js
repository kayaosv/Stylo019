import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'

const POLL_MS = 30000

// Count of ventas awaiting review — polled, not realtime, since we can't
// confirm the `ventas` table has replication enabled for this project. It
// refreshes by itself while the tab is visible and again when the user returns.
export const usePedidosPendientesCount = () => {
  const [count, setCount] = useState(0)
  const unmounted = useRef(false)

  const fetchCount = useCallback(async () => {
    const { count: n, error } = await supabase
      .from('ventas')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')

    if (!unmounted.current && !error) setCount(n ?? 0)
  }, [])

  useEffect(() => {
    unmounted.current = false
    fetchCount()
    return () => {
      unmounted.current = true
    }
  }, [fetchCount])

  useAutoRefresh(fetchCount, POLL_MS)

  return count
}
