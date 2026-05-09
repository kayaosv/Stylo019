import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useProductos } from '@/hooks/useProductos'
import { ProductCard } from '@/components/catalogo/ProductCard'
import { SkeletonCard } from '@/components/catalogo/SkeletonCard'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Reusable home section showing a small grid of products.
 * Used by Novedades (orden='novedad') and Más Vendidos (orden='mas_vendidos').
 */
export const SeccionProductos = ({
  eyebrow,
  titulo,
  descripcion,
  orden = 'novedad',
  limit = 4,
  verTodoHref, // Now dynamically computed via catalogoUrl from orden
}) => {
  const rootRef = useRef(null)
  const titleWordsRef = useRef([])
  const lineRef = useRef(null)
  const gridRef = useRef(null)
  const eyebrowRef = useRef(null)
  const rightColRef = useRef(null)

  // Split title into words for stagger reveal
  const words = useMemo(() => titulo.split(' '), [titulo])

  // Dynamic URL for catalogue based on orden
  const catalogoUrl = useMemo(
    () => `/catalogo?orden=${orden}`,
    [orden]
  )

  // Memoize filtros to avoid unnecessary re-fetches in the hook
  const filtros = useMemo(
    () => ({ orden, porPagina: limit, pagina: 1 }),
    [orden, limit]
  )

  const { productos, loading, error } = useProductos(filtros)

  // Header animations — run once on mount (title, eyebrow, line, right col)
  useGSAP(
    () => {
      if (!rootRef.current) return

      // Title words stagger with yPercent reveal (words hidden by overflow parent)
      gsap.from(titleWordsRef.current, {
        yPercent: 110,
        opacity: 0,
        stagger: 0.08,
        duration: 1.2,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
      })

      // Eyebrow + right column — simple opacity + y
      gsap.from([eyebrowRef.current, rightColRef.current], {
        opacity: 0,
        y: 20,
        duration: 1,
        stagger: 0.08,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
      })

      // Divider line draws across
      gsap.from(lineRef.current, {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 1.4,
        ease: 'expo.inOut',
        scrollTrigger: {
          trigger: lineRef.current,
          start: 'top 95%',
          toggleActions: 'play none none none',
        },
      })
    },
    { scope: rootRef }
  )

  // Card animations — run after products load
  useGSAP(
    () => {
      if (!gridRef.current || loading || productos.length === 0) return

      const cards = gridRef.current.querySelectorAll('[data-product-card]')
      if (!cards.length) return

      gsap.from(cards, {
        y: 40,
        opacity: 0,
        stagger: 0.1,
        duration: 1,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: gridRef.current,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
      })

      // Refresh positions now that new cards replaced skeletons
      ScrollTrigger.refresh()
    },
    { scope: rootRef, dependencies: [loading, productos.length] }
  )

  // Safety net — ensure ScrollTrigger positions are correct after images or
  // other async content changes the layout below this section
  useEffect(() => {
    if (!loading) {
      const id = requestAnimationFrame(() => ScrollTrigger.refresh())
      return () => cancelAnimationFrame(id)
    }
  }, [loading])

  return (
    <section
      ref={rootRef}
      className="relative px-6 md:px-10 pt-24 md:pt-32 pb-24 md:pb-32"
    >
      {/* Header row — title left, description + cta right */}
      <div className="grid grid-cols-12 gap-6 items-end mb-10 md:mb-16">
        {/* Left — eyebrow + title */}
        <div className="col-span-12 md:col-span-7">
          <span
            ref={eyebrowRef}
            className="label-xs text-[var(--color-muted)] block mb-4"
          >
            {eyebrow}
          </span>
          <Link
            to={catalogoUrl}
            className="block group"
            aria-label={`Ver ${titulo}`}
          >
            <h2
              className="flex flex-wrap items-baseline gap-x-[0.25em] gap-y-2 group-hover:opacity-70 transition-opacity"
              style={{ fontSize: 'clamp(2.8rem, 7vw, 7rem)' }}
            >
              {words.map((word, i) => (
                <span
                  key={i}
                  className="overflow-hidden inline-block"
                  style={{ lineHeight: 0.88 }}
                >
                  <span
                    ref={(el) => (titleWordsRef.current[i] = el)}
                    className="block font-serif font-light text-[var(--color-ink)]"
                    style={{
                      fontSize: 'inherit',
                      lineHeight: 0.88,
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {word}
                  </span>
                </span>
              ))}
            </h2>
          </Link>
        </div>

        {/* Right — description + view all */}
        <div
          ref={rightColRef}
          className="col-span-12 md:col-span-4 md:col-start-9 flex flex-col gap-5 md:items-end md:text-right"
        >
          <p
            className="font-serif font-light italic text-[var(--color-muted)] max-w-xs"
            style={{ fontSize: '1.05rem', lineHeight: 1.4 }}
          >
            {descripcion}
          </p>
          <Link
            to={catalogoUrl}
            className="group inline-flex items-baseline gap-2 label-xs text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors"
          >
            Ver todo
            <span
              className="inline-block transition-transform group-hover:translate-x-1"
              aria-hidden
            >
              &rarr;
            </span>
          </Link>
        </div>
      </div>

      {/* Divider line */}
      <div
        ref={lineRef}
        className="h-px bg-[var(--color-surface)] mb-12 md:mb-16"
      />

      {/* Product grid */}
      <div
        ref={gridRef}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8"
      >
        {loading && (
          <>
            {Array.from({ length: limit }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </>
        )}

        {!loading && error && (
          <div className="col-span-full py-10">
            <p
              className="font-serif italic text-[var(--color-muted)] text-center"
              style={{ fontSize: '1.1rem' }}
            >
              {error}
            </p>
          </div>
        )}

        {!loading && !error && productos.length === 0 && (
          <div className="col-span-full py-10">
            <p
              className="font-serif italic text-[var(--color-muted)] text-center"
              style={{ fontSize: '1.1rem' }}
            >
              Aun no hay piezas en esta seleccion.
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          productos.map((producto, i) => (
            <div key={producto.id} data-product-card>
              <ProductCard producto={producto} index={i} />
            </div>
          ))}
      </div>
    </section>
  )
}
