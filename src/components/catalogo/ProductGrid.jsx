import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ProductCard } from '@/components/catalogo/ProductCard'
import { SkeletonCard } from '@/components/catalogo/SkeletonCard'

gsap.registerPlugin(useGSAP, ScrollTrigger)

// Asymmetric product grid — first card breaks the rhythm as a large editorial piece.
// Desktop: 3 columns with first item spanning 2x2. Mobile: regular 2-column grid.
export const ProductGrid = ({
  productos = [],
  loading = false,
  loadingMore = false,
  porPagina = 12,
}) => {
  const gridRef = useRef(null)
  // Tracks how many cards have already been animated to avoid re-animating on loadMore
  const animatedCountRef = useRef(0)

  // Stagger reveal — only for cards that haven't been animated yet
  useGSAP(
    () => {
      if (loading) {
        animatedCountRef.current = 0
        return
      }
      if (!productos.length) return

      const allCards = gridRef.current?.querySelectorAll('[data-product-card]')
      if (!allCards?.length) return

      const newCards = [...allCards].slice(animatedCountRef.current)
      if (!newCards.length) return

      animatedCountRef.current = allCards.length

      gsap.fromTo(
        newCards,
        { yPercent: 30, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.7,
          ease: 'expo.out',
          stagger: 0.06,
          scrollTrigger: {
            trigger: newCards[0],
            start: 'top 88%',
            once: true,
          },
        }
      )
    },
    { scope: gridRef, dependencies: [loading, productos.length] }
  )

  // Editorial empty state
  if (!loading && productos.length === 0) {
    return (
      <div
        ref={gridRef}
        className="flex items-center justify-center py-32 lg:py-48"
      >
        <p
          className="font-serif font-light text-center text-[var(--color-muted)] italic"
          style={{
            fontSize: 'clamp(1.4rem, 3vw, 2.4rem)',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}
        >
          No encontramos piezas
          <br />
          con estos filtros
        </p>
      </div>
    )
  }

  // Initial loading skeletons — keep the asymmetric rhythm
  if (loading) {
    return (
      <div
        ref={gridRef}
        className="grid gap-6 sm:gap-8 lg:gap-10 grid-cols-2 lg:grid-cols-3"
        style={{ gridAutoFlow: 'dense' }}
      >
        {Array.from({ length: porPagina }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            className={i === 0 ? 'lg:col-span-2 lg:row-span-2' : ''}
          >
            <SkeletonCard />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={gridRef}
      className="grid gap-6 sm:gap-8 lg:gap-10 grid-cols-2 lg:grid-cols-3"
      style={{ gridAutoFlow: 'dense' }}
    >
      {productos.map((producto, index) => {
        const destacado = index === 0
        return (
          <div
            key={producto.id ?? index}
            data-product-card
            className={destacado ? 'lg:col-span-2 lg:row-span-2' : ''}
            style={{ willChange: 'transform, opacity' }}
          >
            <ProductCard producto={producto} index={index} />
          </div>
        )
      })}

      {/* Skeleton cards appended at the end while loading more */}
      {loadingMore &&
        Array.from({ length: 4 }).map((_, i) => (
          <div key={`more-skeleton-${i}`}>
            <SkeletonCard />
          </div>
        ))}
    </div>
  )
}
