import { useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { formatPrice } from '@/lib/precio'
import { getOptimizedUrl } from '@/services/storage'
import { estaAgotado, TALLA_SETS } from '@/lib/tallas'

gsap.registerPlugin(useGSAP)

export const ProductCard = ({ producto, index = 0 }) => {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const imageRef = useRef(null)
  const overlayRef = useRef(null)
  const overlayContentRef = useRef(null)
  const arrowRef = useRef(null)

  // Quick tween refs for high-frequency hover events
  const imageScaleTo = useRef(null)
  const overlayClipTo = useRef(null)
  const contentYTo = useRef(null)
  const arrowXTo = useRef(null)

  // Editorial order number — "01", "02", etc.
  const editorialNumber = useMemo(
    () => String(index + 1).padStart(2, '0'),
    [index]
  )

  const hasOferta = producto?.precio_oferta != null && producto.precio_oferta < producto.precio
  const precioEfectivo = hasOferta ? producto.precio_oferta : producto.precio
  const { int: precioInt, dec: precioDec } = formatPrice(precioEfectivo)
  const { int: precioOrigInt, dec: precioOrigDec } = formatPrice(producto?.precio)
  const primeraImagen = producto?.imagenes?.[0] ?? ''
  const categoria = producto?.categoria ?? ''
  const agotado = estaAgotado(producto?.tallas)
  // Size order matches the product's talla type (ropa, curvy, calzado…)
  const tallaOrder = TALLA_SETS[producto?.tipo_talla] ?? TALLA_SETS.ropa

  // Build quickTo setters once
  useGSAP(
    () => {
      imageScaleTo.current = gsap.quickTo(imageRef.current, 'scale', {
        duration: 1,
        ease: 'power2.out',
      })

      // Overlay clip-path reveal — same inset() function at start and end
      gsap.set(overlayRef.current, { clipPath: 'inset(100% 0% 0% 0%)' })
      gsap.set(overlayContentRef.current, { y: 30, opacity: 0 })
      gsap.set(arrowRef.current, { x: -12, opacity: 0 })
    },
    { scope: containerRef }
  )

  const handleMouseEnter = () => {
    // Image subtle zoom
    gsap.to(imageRef.current, {
      scale: 1.04,
      duration: 1,
      ease: 'power2.out',
      overwrite: 'auto',
    })

    // Overlay wipe from bottom to top
    gsap.to(overlayRef.current, {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 0.5,
      ease: 'expo.out',
      overwrite: 'auto',
    })

    // Content rises with stagger feel
    gsap.to(overlayContentRef.current, {
      y: 0,
      opacity: 1,
      duration: 0.55,
      delay: 0.1,
      ease: 'expo.out',
      overwrite: 'auto',
    })

    // Arrow slides in from the left
    gsap.to(arrowRef.current, {
      x: 0,
      opacity: 1,
      duration: 0.6,
      delay: 0.15,
      ease: 'expo.out',
      overwrite: 'auto',
    })
  }

  const handleMouseLeave = () => {
    gsap.to(imageRef.current, {
      scale: 1,
      duration: 0.8,
      ease: 'power2.out',
      overwrite: 'auto',
    })

    gsap.to(overlayRef.current, {
      clipPath: 'inset(100% 0% 0% 0%)',
      duration: 0.35,
      ease: 'expo.in',
      overwrite: 'auto',
    })

    gsap.to(overlayContentRef.current, {
      y: 30,
      opacity: 0,
      duration: 0.25,
      ease: 'expo.in',
      overwrite: 'auto',
    })

    gsap.to(arrowRef.current, {
      x: -12,
      opacity: 0,
      duration: 0.25,
      ease: 'expo.in',
      overwrite: 'auto',
    })
  }

  const handleClick = () => {
    if (producto?.id != null) navigate(`/producto/${producto.id}`)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <article
      ref={containerRef}
      role="button"
      tabIndex={0}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Ver ${producto?.nombre ?? 'producto'}`}
      data-cursor="view"
      data-cursor-label="Ver pieza"
      className="group relative flex flex-col cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
    >
      {/* Image wrapper — fixed editorial ratio */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '3/4', background: 'var(--color-surface)' }}
      >
        {/* Product image */}
        <img
          ref={imageRef}
          src={getOptimizedUrl(primeraImagen, { w: 600 })}
          alt={producto?.nombre ?? ''}
          loading={index < 4 ? 'eager' : 'lazy'}
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover will-change-transform"
          style={{
            transformOrigin: 'center center',
            opacity: agotado ? 0.45 : 1,
            filter: agotado ? 'grayscale(0.6)' : 'none',
          }}
        />

        {/* Sold-out banner — product fully out of stock across every size */}
        {agotado && (
          <div
            className="absolute left-0 right-0 z-30 flex items-center justify-center py-2.5 pointer-events-none"
            style={{
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(10, 10, 10, 0.82)',
            }}
          >
            <span
              className="label-xs"
              style={{
                color: 'var(--color-base)',
                letterSpacing: '0.22em',
              }}
            >
              Agotado
            </span>
          </div>
        )}

        {/* Editorial order number — top left */}
        <span
          className="label-xs absolute top-4 left-4 z-10 mix-blend-difference"
          style={{ color: 'var(--color-paper)' }}
        >
          {editorialNumber}
        </span>

        {/* Category label — top right */}
        <span
          className="label-xs absolute top-4 right-4 z-10 mix-blend-difference"
          style={{ color: 'var(--color-paper)' }}
        >
          {categoria}
        </span>

        {/* Badges — oferta / destacado / más vendido */}
        {(producto?.destacado || producto?.mas_vendido || hasOferta) && (
          <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1">
            {hasOferta && (
              <span
                className="label-xs px-1.5 py-0.5"
                style={{
                  color: '#fff',
                  background: '#dc2626',
                }}
              >
                Oferta
              </span>
            )}
            {producto?.mas_vendido && (
              <span
                className="label-xs px-1.5 py-0.5"
                style={{
                  color: 'var(--color-paper)',
                  background: 'var(--color-accent-ink)',
                }}
              >
                Más vendido
              </span>
            )}
            {producto?.destacado && (
              <span
                className="label-xs px-1.5 py-0.5"
                style={{
                  color: 'var(--color-paper)',
                  background: 'var(--color-ink)',
                }}
              >
                Destacado
              </span>
            )}
          </div>
        )}

        {/* Hover overlay — clip-path reveal from bottom */}
        <div
          ref={overlayRef}
          className="absolute inset-0 z-20 flex items-end justify-start p-6 pointer-events-none"
          style={{
            background: 'rgba(10, 10, 10, 0.88)',
            clipPath: 'inset(100% 0% 0% 0%)',
            willChange: 'clip-path',
          }}
        >
          <div
            ref={overlayContentRef}
            className="flex flex-col gap-2"
            style={{ willChange: 'transform, opacity' }}
          >
            <span
              className="label-xs"
              style={{ color: 'var(--color-surface)' }}
            >
              {categoria}
            </span>
            <span
              className="font-serif italic font-light leading-none"
              style={{
                color: 'var(--color-base)',
                fontSize: 'clamp(1.8rem, 3.2vw, 2.6rem)',
                letterSpacing: '-0.02em',
              }}
            >
              Ver pieza
            </span>
          </div>

          {/* Arrow — bottom right of overlay */}
          <span
            ref={arrowRef}
            className="absolute bottom-6 right-6 font-serif"
            style={{
              color: 'var(--color-base)',
              fontSize: '1.8rem',
              lineHeight: 1,
              willChange: 'transform, opacity',
            }}
            aria-hidden
          >
            &rarr;
          </span>
        </div>
      </div>

      {/* Info block — below image */}
      <div className="flex flex-col gap-3 pt-4 px-1">
        {/* Name + price row */}
        <div className="flex items-start justify-between gap-4">
          <h3
            className="font-serif font-light leading-tight"
            style={{
              color: 'var(--color-ink)',
              fontSize: '1.2rem',
              letterSpacing: '-0.01em',
            }}
          >
            {producto?.nombre ?? ''}
          </h3>

          <div className="flex items-baseline gap-2 shrink-0">
            {hasOferta && (
              <p
                className="font-serif flex items-start line-through"
                style={{ color: '#dc2626', fontWeight: 400, opacity: 0.85 }}
              >
                <span
                  style={{
                    fontSize: '0.45rem',
                    lineHeight: 1,
                    marginTop: '0.25rem',
                    marginRight: '0.05rem',
                  }}
                >
                  &euro;
                </span>
                <span style={{ fontSize: '0.95rem', lineHeight: 1 }}>
                  {precioOrigInt}
                </span>
              </p>
            )}
            <p
              className="font-serif flex items-start"
              style={{ color: 'var(--color-ink)', fontWeight: 600 }}
            >
              <span
                style={{
                  fontSize: '0.6rem',
                  lineHeight: 1,
                  marginTop: '0.35rem',
                  marginRight: '0.1rem',
                }}
              >
                &euro;
              </span>
              <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>
                {precioInt}
                <span style={{ fontSize: '0.75rem', marginLeft: '0.1rem' }}>
                  .{precioDec}
                </span>
              </span>
            </p>
          </div>
        </div>

        {/* Sizes row */}
        <div className="flex items-center gap-3 flex-wrap">
          {tallaOrder.map((talla) => {
            const stock = producto?.tallas?.[talla] ?? 0
            const disponible = stock > 0
            return (
              <span
                key={talla}
                className="label-xs"
                style={{
                  color: disponible
                    ? 'var(--color-ink)'
                    : 'var(--color-muted-soft)',
                  textDecoration: disponible ? 'none' : 'line-through',
                  textDecorationThickness: disponible ? undefined : '1.5px',
                }}
              >
                {talla}
              </span>
            )
          })}
        </div>
      </div>
    </article>
  )
}
