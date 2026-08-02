import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useCartStore } from '@/store/useCartStore'
import { useUIStore } from '@/store/useUIStore'
import { getPrecioEfectivo, formatPrice } from '@/lib/precio'

gsap.registerPlugin(useGSAP)

// Single line item inside CartDrawer. Shows thumbnail, name, size,
// subtotal (price × quantity), quantity controls, and remove button.
export const ItemCarrito = ({ item }) => {
  const updateCantidad = useCartStore((s) => s.updateCantidad)
  const removeItem = useCartStore((s) => s.removeItem)
  const closeCart = useUIStore((s) => s.closeCart)

  const rootRef = useRef(null)
  const minusBtnRef = useRef(null)
  const plusBtnRef = useRef(null)
  const [removing, setRemoving] = useState(false)

  // Slide-out animation before the store actually removes the item
  useGSAP(
    () => {
      if (!removing) return
      gsap.to(rootRef.current, {
        x: '100%',
        opacity: 0,
        duration: 0.35,
        ease: 'power2.in',
        onComplete: () => removeItem(item.id, item.talla, item.colorId ?? null),
      })
    },
    { scope: rootRef, dependencies: [removing] }
  )

  const bump = (ref) => {
    if (!ref.current) return
    gsap.fromTo(
      ref.current,
      { scale: 0.85 },
      { scale: 1, duration: 0.3, ease: 'back.out(2)' }
    )
  }

  // stockDisponible is a snapshot taken when the item was added (see
  // useCartStore.addItem) — undefined on cart lines persisted before this
  // change, so those fall back to no cap rather than getting stuck.
  const atMax = item.stockDisponible != null && item.cantidad >= item.stockDisponible

  const handleMinus = () => {
    bump(minusBtnRef)
    updateCantidad(item.id, item.talla, item.colorId ?? null, item.cantidad - 1)
  }

  const handlePlus = () => {
    if (atMax) return
    bump(plusBtnRef)
    updateCantidad(item.id, item.talla, item.colorId ?? null, item.cantidad + 1)
  }

  const price = item.precioUnitario ?? getPrecioEfectivo(item, item.talla)
  const subtotal = price * item.cantidad
  const { int, dec } = formatPrice(subtotal)
  const thumb = item.colorImagen ?? item.imagenes?.[0] ?? null

  return (
    <div
      ref={rootRef}
      className="flex gap-4 py-5 border-b"
      style={{ borderColor: 'var(--color-surface)', willChange: 'transform, opacity' }}
    >
      {/* Thumbnail */}
      <Link
        to={`/producto/${item.id}`}
        onClick={closeCart}
        className="shrink-0 block overflow-hidden"
        style={{ width: '5rem', aspectRatio: '3/4', background: 'var(--color-surface)' }}
      >
        {thumb && (
          <img
            src={thumb}
            alt={item.nombre}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        )}
      </Link>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              to={`/producto/${item.id}`}
              onClick={closeCart}
              className="font-serif font-light block truncate hover:underline underline-offset-2"
              style={{
                fontSize: '1.05rem',
                color: 'var(--color-ink)',
                letterSpacing: '-0.01em',
              }}
            >
              {item.nombre}
            </Link>
            <p className="label-xs mt-1" style={{ color: 'var(--color-muted)' }}>
              {item.colorLabel ? `${item.colorLabel} · Talla ${item.talla}` : `Talla · ${item.talla}`}
            </p>
          </div>

          {/* Remove button */}
          <button
            type="button"
            onClick={() => setRemoving(true)}
            aria-label={`Quitar ${item.nombre} talla ${item.talla}`}
            className="shrink-0 transition-colors duration-200"
            style={{ color: 'var(--color-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted)')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Bottom row: quantity controls + subtotal */}
        <div className="flex items-end justify-between gap-3 mt-1">
          {/* Quantity stepper */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <button
                ref={minusBtnRef}
                type="button"
                onClick={handleMinus}
                aria-label="Disminuir cantidad"
                className="flex items-center justify-center border transition-colors duration-200"
                style={{
                  width: '1.75rem',
                  height: '1.75rem',
                  borderColor: 'var(--color-surface)',
                  color: 'var(--color-ink)',
                  willChange: 'transform',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>

              <span
                className="label-xs tabular-nums"
                style={{ color: 'var(--color-ink)', minWidth: '1.5rem', textAlign: 'center' }}
              >
                {String(item.cantidad).padStart(2, '0')}
              </span>

              <button
                ref={plusBtnRef}
                type="button"
                onClick={handlePlus}
                disabled={atMax}
                aria-label={atMax ? 'Sin más stock disponible' : 'Aumentar cantidad'}
                className="flex items-center justify-center border transition-colors duration-200"
                style={{
                  width: '1.75rem',
                  height: '1.75rem',
                  borderColor: atMax ? 'var(--color-surface)' : 'var(--color-accent)',
                  color: atMax ? 'var(--color-muted-soft)' : 'var(--color-accent)',
                  opacity: atMax ? 0.5 : 1,
                  cursor: atMax ? 'not-allowed' : 'pointer',
                  willChange: 'transform',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>

            {atMax && (
              <span className="label-xs" style={{ color: 'var(--color-muted-soft)', fontSize: '0.62rem' }}>
                Última unidad disponible
              </span>
            )}
          </div>

          {/* Subtotal */}
          <p className="font-serif flex items-start" style={{ color: 'var(--color-accent-ink)' }}>
            <span style={{ fontSize: '0.6rem', lineHeight: 1, marginTop: '0.35rem', marginRight: '0.1rem' }}>
              &euro;
            </span>
            <span
              style={{
                fontSize: '1.35rem',
                lineHeight: 1,
                letterSpacing: '-0.02em',
                fontWeight: 600,
              }}
            >
              {int}
              <span style={{ fontSize: '0.75rem', marginLeft: '0.1rem', fontWeight: 400 }}>
                .{dec}
              </span>
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
