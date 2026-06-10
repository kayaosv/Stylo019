import { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProductosInfinite } from '@/hooks/useProductosInfinite'
import { ProductGrid } from '@/components/catalogo/ProductGrid'
import { Filtros } from '@/components/catalogo/Filtros'
import { FiltrosDrawer } from '@/components/catalogo/FiltrosDrawer'
import { FiltrosActivos } from '@/components/catalogo/FiltrosActivos'
import { Buscador } from '@/components/catalogo/Buscador'
import { Ordenamiento } from '@/components/catalogo/Ordenamiento'
import { Newsletter } from '@/components/home/Newsletter'

const POR_PAGINA = 12

// Parse URL search params into filter object (no pagina — managed by the hook)
const parseFiltros = (params) => ({
  busqueda: params.get('q') || null,
  categoria: params.get('cat') || null,
  tallaDisponible: params.get('talla') || null,
  precioMin: params.get('pMin') ? Number(params.get('pMin')) : null,
  precioMax: params.get('pMax') ? Number(params.get('pMax')) : null,
  orden: params.get('orden') || 'novedad',
})

// Serialize filter object back to URL params (omit null/default values)
const serializeFiltros = (filtros) => {
  const p = {}
  if (filtros.busqueda)        p.q     = filtros.busqueda
  if (filtros.categoria)       p.cat   = filtros.categoria
  if (filtros.tallaDisponible) p.talla = filtros.tallaDisponible
  if (filtros.precioMin != null) p.pMin = filtros.precioMin
  if (filtros.precioMax != null) p.pMax = filtros.precioMax
  if (filtros.orden && filtros.orden !== 'novedad') p.orden = filtros.orden
  return p
}

const Catalogo = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const sentinelRef = useRef(null)

  const filtros = useMemo(() => parseFiltros(searchParams), [searchParams.toString()])

  const {
    productos,
    loading,
    loadingMore,
    hasMore,
    total,
    loadMore,
  } = useProductosInfinite(filtros)

  // IntersectionObserver — triggers loadMore when sentinel enters viewport
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: '0px', threshold: 0.1 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  // Merge partial filter update into URL (always resets to page 1 via hook)
  const handleFiltroChange = useCallback(
    (parcial) => {
      const nuevo = { ...filtros, ...parcial }
      setSearchParams(serializeFiltros(nuevo), { replace: true })
    },
    [filtros, setSearchParams]
  )

  // Clear all filters
  const handleLimpiar = useCallback(
    () => setSearchParams({}, { replace: true }),
    [setSearchParams]
  )

  // Clear a single filter field
  const handleQuitarFiltro = useCallback(
    (campo) => handleFiltroChange({ [campo]: null }),
    [handleFiltroChange]
  )

  const handleBusqueda = useCallback(
    (q) => handleFiltroChange({ busqueda: q || null }),
    [handleFiltroChange]
  )

  const handleOrden = useCallback(
    (orden) => handleFiltroChange({ orden }),
    [handleFiltroChange]
  )

  const filtrosSidebar = {
    categoria: filtros.categoria,
    tallaDisponible: filtros.tallaDisponible,
    precioMin: filtros.precioMin,
    precioMax: filtros.precioMax,
  }

  const hayFiltrosActivos =
    !!filtros.categoria ||
    !!filtros.tallaDisponible ||
    filtros.precioMin != null ||
    filtros.precioMax != null ||
    !!filtros.busqueda

  return (
    <div
      className="min-h-screen pt-28 md:pt-40"
      style={{ background: 'var(--color-base)' }}
    >
      {/* Catalog hero — editorial header */}
      <div
        className="relative px-6 md:px-12 pb-8 overflow-hidden flex items-end"
        style={{ minHeight: 'clamp(6rem, 16vw, 14rem)' }}
      >
        <span
          className="absolute bottom-0 left-4 md:left-8 select-none pointer-events-none font-serif font-semibold leading-none"
          style={{
            fontSize: 'clamp(5rem, 16vw, 14rem)',
            color: 'var(--color-surface)',
            letterSpacing: '-0.04em',
            lineHeight: 0.85,
            zIndex: 0,
          }}
          aria-hidden
        >
          Catalogo
        </span>

        <div className="relative z-10 flex flex-col gap-2 pb-4">
          <span className="label-xs text-[var(--color-accent-ink)]">
            Av. Ildefonso Marañón Lavín &mdash; Sevilla
          </span>
          <p
            className="font-sans font-light text-[var(--color-muted)] italic"
            style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}
          >
            {loading ? '...' : `( ${total} piezas )`}
          </p>
        </div>
      </div>

      {/* Search bar — full width */}
      <div className="px-6 md:px-12 pb-10">
        <Buscador valor={filtros.busqueda ?? ''} onChange={handleBusqueda} />
      </div>

      {/* Main layout: sidebar + grid */}
      <div className="px-6 md:px-12 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-12 xl:gap-20">

          {/* Sidebar filters */}
          <div className="hidden lg:block">
            <Filtros
              filtros={filtrosSidebar}
              onChange={handleFiltroChange}
              onLimpiar={handleLimpiar}
              totalResultados={total}
            />
          </div>

          {/* Product area */}
          <div className="flex flex-col gap-8">
            {/* Sort row */}
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setFiltrosOpen(true)}
                className="lg:hidden label-xs flex items-center gap-2 border border-[var(--color-ink)] px-3 py-2"
                style={{ color: 'var(--color-ink)' }}
                aria-label="Abrir filtros"
                data-cursor="link"
                data-cursor-label="Filtrar"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                >
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="7" y1="12" x2="17" y2="12" />
                  <line x1="10" y1="18" x2="14" y2="18" />
                </svg>
                Filtrar
              </button>

              <Ordenamiento valor={filtros.orden} onChange={handleOrden} />

              <span className="lg:hidden label-xs text-[var(--color-muted)] italic">
                {loading ? '...' : `( ${total} )`}
              </span>
            </div>

            {/* Active filter chips — visible when any filter is on */}
            {hayFiltrosActivos && (
              <FiltrosActivos
                filtros={filtros}
                onQuitarFiltro={handleQuitarFiltro}
                onLimpiar={handleLimpiar}
              />
            )}

            {/* Grid */}
            <ProductGrid
              productos={productos}
              loading={loading}
              loadingMore={loadingMore}
              porPagina={POR_PAGINA}
            />

            {/* Sentinel for IntersectionObserver — invisible trigger point */}
            <div ref={sentinelRef} aria-hidden style={{ height: 1 }} />

            {/* "Ver más" button — fallback explicit control */}
            {!loading && hasMore && (
              <div className="flex justify-center pt-4 pb-2">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="label-xs border border-[var(--color-ink)] px-8 py-3 transition-colors duration-300 disabled:opacity-40"
                  style={{ color: 'var(--color-ink)', letterSpacing: '0.18em' }}
                  onMouseEnter={(e) => {
                    if (!loadingMore) {
                      e.currentTarget.style.background = 'var(--color-ink)'
                      e.currentTarget.style.color = 'var(--color-paper)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--color-ink)'
                  }}
                >
                  {loadingMore ? 'Cargando...' : 'Ver más'}
                </button>
              </div>
            )}

            {/* End of catalog message */}
            {!loading && !hasMore && productos.length > 0 && (
              <p
                className="text-center label-xs text-[var(--color-muted)] italic py-4"
                style={{ letterSpacing: '0.1em' }}
              >
                — Fin del catálogo —
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filters drawer */}
      <FiltrosDrawer
        open={filtrosOpen}
        onClose={() => setFiltrosOpen(false)}
        filtros={filtrosSidebar}
        onChange={handleFiltroChange}
        onLimpiar={handleLimpiar}
        totalResultados={total}
      />

      <Newsletter />
    </div>
  )
}

export default Catalogo
