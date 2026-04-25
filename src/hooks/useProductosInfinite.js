import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchProductos } from '@/services/productos'

const POR_PAGINA = 12

/**
 * Infinite-scroll variant of useProductos.
 * Manages page internally; accumulates results across loads.
 * Resets when filters change (filtros must not include pagina).
 *
 * @param {Object} filtros - { categoria, tallaDisponible, precioMin, precioMax, busqueda, orden }
 * @returns {{ productos, loading, loadingMore, hasMore, total, error, loadMore }}
 */
export const useProductosInfinite = (filtros = {}) => {
  const [productos, setProductos] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const pageRef = useRef(1)
  const filtrosKey = JSON.stringify(filtros)

  // Reset and load page 1 when filters change
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      pageRef.current = 1

      const { data, count, error: err } = await fetchProductos({
        ...filtros,
        pagina: 1,
        porPagina: POR_PAGINA,
      })

      if (cancelled) return

      if (err) {
        setError('Error cargando productos. Inténtalo de nuevo.')
        setProductos([])
        setTotal(0)
      } else {
        setProductos(data)
        setTotal(count)
      }

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosKey])

  const loadMore = useCallback(async () => {
    if (loading || loadingMore) return
    if (productos.length >= total) return

    setLoadingMore(true)
    const nextPage = pageRef.current + 1

    const { data, error: err } = await fetchProductos({
      ...filtros,
      pagina: nextPage,
      porPagina: POR_PAGINA,
    })

    if (!err && data.length > 0) {
      pageRef.current = nextPage
      setProductos((prev) => [...prev, ...data])
    }

    setLoadingMore(false)
    // filtros intentionally excluded — loadMore uses the current filter snapshot via closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadingMore, productos.length, total, filtrosKey])

  const hasMore = productos.length < total

  return { productos, loading, loadingMore, hasMore, total, error, loadMore }
}
