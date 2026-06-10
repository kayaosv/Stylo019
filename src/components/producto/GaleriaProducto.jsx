import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { getOptimizedUrl } from '@/services/storage'

gsap.registerPlugin(useGSAP)

// Product image gallery with vertical thumbnail strip (desktop) and
// horizontal scroll-snap strip (mobile). GSAP crossfade on image change.
export const GaleriaProducto = ({ imagenes = [], nombre = '' }) => {
  const [activeIdx, setActiveIdx] = useState(0)

  const containerRef = useRef(null)
  const wrapperRef = useRef(null)
  const mainImgRef = useRef(null)

  // Entry animation — slide in from left once on mount
  useGSAP(
    () => {
      if (!wrapperRef.current) return
      gsap.from(wrapperRef.current, {
        x: -40,
        opacity: 0,
        duration: 1,
        ease: 'expo.out',
        delay: 0.1,
      })
    },
    { scope: containerRef }
  )

  // Crossfade to a new image on thumbnail click
  const cambiarImagen = (idx) => {
    if (idx === activeIdx || !mainImgRef.current) return

    gsap.to(mainImgRef.current, {
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: () => {
        setActiveIdx(idx)
        // Double rAF ensures React has flushed the new src to the DOM
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (mainImgRef.current) {
              gsap.to(mainImgRef.current, {
                opacity: 1,
                duration: 0.35,
                ease: 'power2.out',
              })
            }
          })
        })
      },
    })
  }

  const fallback = imagenes.length > 0 ? imagenes[0] : ''

  return (
    <div ref={containerRef}>
      {/* ── Desktop layout: thumbnail strip + main image ── */}
      <div
        ref={wrapperRef}
        className="hidden md:flex gap-3"
        style={{ willChange: 'transform, opacity' }}
      >
        {/* Thumbnail strip — vertical left column */}
        {imagenes.length > 1 && (
          <div className="flex flex-col gap-2" style={{ width: '4rem', flexShrink: 0 }}>
            {imagenes.map((url, i) => (
              <button
                key={i}
                onClick={() => cambiarImagen(i)}
                aria-label={`Ver imagen ${i + 1}`}
                className="relative w-full overflow-hidden transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
                style={{
                  aspectRatio: '3/4',
                  background: 'var(--color-surface)',
                  opacity: i === activeIdx ? 1 : 0.45,
                  outline: i === activeIdx ? '1px solid var(--color-accent)' : 'none',
                  outlineOffset: '2px',
                  transition: 'opacity 0.25s, outline-color 0.25s',
                  flexShrink: 0,
                }}
              >
                <img
                  src={getOptimizedUrl(url, { w: 200 })}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Main image */}
        <div
          className="flex-1 overflow-hidden relative"
          style={{ aspectRatio: '3/4', background: 'var(--color-surface)' }}
        >
          <img
            ref={mainImgRef}
            src={getOptimizedUrl(imagenes[activeIdx] ?? fallback, { w: 1200 })}
            alt={nombre}
            loading="eager"
            fetchpriority="high"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover will-change-[opacity]"
          />
        </div>
      </div>

      {/* ── Mobile layout: horizontal scroll-snap strip ── */}
      <div
        className="md:hidden w-full"
        style={{ aspectRatio: '3/4', position: 'relative' }}
      >
        <div
          className="flex w-full h-full"
          style={{
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {(imagenes.length > 0 ? imagenes : [fallback]).map((url, i) => (
            <div
              key={i}
              style={{
                minWidth: '100%',
                height: '100%',
                scrollSnapAlign: 'start',
                flexShrink: 0,
                background: 'var(--color-surface)',
                position: 'relative',
              }}
            >
              <img
                src={getOptimizedUrl(url, { w: i === 0 ? 800 : 600 })}
                alt={i === 0 ? nombre : ''}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          ))}
        </div>

        {/* Dot indicators for mobile (only when multiple images) */}
        {imagenes.length > 1 && (
          <div
            className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none"
          >
            {imagenes.map((_, i) => (
              <span
                key={i}
                style={{
                  width: '0.35rem',
                  height: '0.35rem',
                  borderRadius: '50%',
                  background: 'var(--color-base)',
                  opacity: 0.7,
                  display: 'block',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
