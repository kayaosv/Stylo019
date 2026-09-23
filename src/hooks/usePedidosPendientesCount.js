import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const POLL_MS = 30000

// Count of ventas awaiting review — polled, not realtime, since we can't
// confirm the `ventas` table has replication enabled for this project.
export const usePedidosPendientesCount = () => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    const fetchCount = async () => {
      const { count: n, error } = await supabase
        .from('ventas')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'pendiente')

      if (!cancelled && !error) setCount(n ?? 0)
    }

    fetchCount()
    const interval = setInterval(fetchCount, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return count
}
