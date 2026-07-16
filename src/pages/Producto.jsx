import { useRef, useState, useMemo, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useProducto } from '@/hooks/useProducto'
import { useCartStore } from '@/store/useCartStore'
import { useUIStore } from '@/store/useUIStore'
import { GaleriaProducto } from '@/components/producto/GaleriaProducto'
import { SelectorTalla } from '@/components/producto/SelectorTalla'
import { ProductosRelacionados } from '@/components/producto/ProductosRelacionados'
import { getPrecioBase, getPrecioEfectivo, formatPrice } from '@/lib/precio'
import { normalizeColores } from '@/lib/colores'
import { estaAgotado } from '@/lib/tallas'

gsap.registerPlugin(useGSAP)

// Build a pre-filled WhatsApp message URL for a specific product + size
const buildWhatsAppUrl = (nombre, talla, precio) => {
  const numero = '34658509332'
  const msg = `Hola! Me interesa *${nombre}* en talla *${talla}* (€${Number(precio).toFixed(2)}). ¿Está disponible?`
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`
}

// ── Loading skeleton ────────────────────────────────────────────────────────
const PageSkeleton = () => (
  <div
    className="px-6 md:px-12 py-12"
    style={{ minHeight: '100vh', paddingTop: '10rem' }}
  >
    <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-12 lg:gap-16">
      {/* Gallery skeleton */}
      <div className="flex gap-3">
        <div className="flex flex-col gap-2" style={{ width: '4rem', flexShrink: 0 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-full skeleton-shine"
              style={{ aspectRatio: '3/4', background: 'var(--color-surface)' }}
            />
          ))}
        </div>
        <div
          className="flex-1 skeleton-shine"
          style={{ aspectRatio: '3/4', background: 'var(--color-surface)' }}
        />
      </div>

      {/* Info panel skeleton */}
      <div className="flex flex-col gap-6 pt-4">
        <div className="skeleton-shine h-3 w-1/3" style={{ background: 'var(--color-surface)' }} />
        <div className="skeleton-shine h-12 w-3/4" style={{ background: 'var(--color-surface)' }} />
        <div className="skeleton-shine h-8 w-1/4" style={{ background: 'var(--color-surface)' }} />
        <div className="flex flex-col gap-2">
          <div className="skeleton-shine h-3 w-full" style={{ background: 'var(--color-surface)' }} />
          <div className="skeleton-shine h-3 w-5/6" style={{ background: 'var(--color-surface)' }} />
          <div className="skeleton-shine h-3 w-4/6" style={{ background: 'var(--color-surface)' }} />
        </div>
        <div className="flex gap-2 mt-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="skeleton-shine"
              style={{ width: '2.75rem', height: '2.75rem', background: 'var(--color-surface)' }}
            />
          ))}
        </div>
      </div>
    </div>
  </div>
)

// ── Main page component ─────────────────────────────────────────────────────
const Producto = () => {
  const { id } = useParams()

  const { producto, relacionados, loading, notFound, error } = useProducto(id)

  const [tallaSeleccionada, setTallaSeleccionada] = useState(null)
  const [colorSeleccionado, setColorSeleccionado] = useState(null)
  const [addedFeedback, setAddedFeedback] = useState(false)

  const coloresDisponibles = useMemo(
    () => normalizeColores(producto?.colores),
    [producto]
  )

  // Default-select the first color variant when product arrives
  useEffect(() => {
    if (coloresDisponibles.length > 0 && !colorSeleccionado) {
      setColorSeleccionado(coloresDisponibles[0].id)
    }
  }, [coloresDisponibles, colorSeleccionado])

  const colorActivo = useMemo(
    () => coloresDisponibles.find((c) => c.id === colorSeleccionado) ?? null,
    [coloresDisponibles, colorSeleccionado]
  )

  // Colors with their own stock map override the product's global tallas;
  // colors without one (or products with no colors at all) fall back to it.
  const tallasActivas = colorActivo?.tallas ?? producto?.tallas ?? {}

  const imagenesGaleria = useMemo(() => {
    if (colorActivo?.imagenes?.length) return colorActivo.imagenes
    return producto?.imagenes ?? []
  }, [producto, colorActivo])

  const addItem = useCartStore((s) => s.addItem)
  const openCart = useUIStore((s) => s.openCart)

  const infoPanelRef = useRef(null)
  const btnAnadirRef = useRef(null)

  // Stagger entry animation for the info panel once data arrives
  useGSAP(
    () => {
      if (loading || !producto || !infoPanelRef.current) return

      const elements = infoPanelRef.current.querySelectorAll('[data-animate]')
      if (!elements.length) return

      gsap.fromTo(
        elements,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'expo.out',
          stagger: 0.08,
          delay: 0.15,
        }
      )
    },
    { scope: infoPanelRef, dependencies: [loading, producto] }
  )

  const handleAddToCart = () => {
    if (!tallaSeleccionada || !producto) return

    addItem(producto, tallaSeleccionada, colorActivo)
    openCart()

    if (btnAnadirRef.current) {
      gsap.fromTo(
        btnAnadirRef.current,
        { scale: 0.95 },
        { scale: 1, duration: 0.5, ease: 'back.out(2)' }
      )
    }

    setAddedFeedback(true)
    setTimeout(() => setAddedFeedback(false), 2000)
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return <PageSkeleton />

  // ── Not found / error ─────────────────────────────────────────────────────
  if (notFound || error) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-8 px-6"
        style={{ minHeight: '100vh', paddingTop: '10rem', paddingBottom: '6rem' }}
      >
        <span
          className="font-serif font-semibold leading-none select-none"
          style={{
            fontSize: 'clamp(5rem, 18vw, 13rem)',
            letterSpacing: '-0.05em',
            color: 'var(--color-surface)',
          }}
        >
          {notFound ? '404' : '—'}
        </span>

        <p className="label-xs" style={{ color: 'var(--color-muted)' }}>
          {notFound
            ? 'Esta pieza no existe o ya no está disponible'
            : 'Error cargando el producto'}
        </p>

        <Link
          to="/catalogo"
          className="font-serif font-light hover:underline underline-offset-4 transition-colors"
          style={{ fontSize: '1.1rem', color: 'var(--color-accent-ink)', letterSpacing: '-0.01em' }}
        >
          ← Volver al Catalogo
        </Link>
      </div>
    )
  }

  if (!producto) return null

  const precioBase = getPrecioBase(producto, tallaSeleccionada)
  const precioEfectivo = getPrecioEfectivo(producto, tallaSeleccionada)
  const hasOferta = precioEfectivo < precioBase
  const { int: precioInt, dec: precioDec } = formatPrice(precioEfectivo)
  const { int: precioOrigInt, dec: precioOrigDec } = formatPrice(precioBase)
  const whatsappUrl = tallaSeleccionada
    ? buildWhatsAppUrl(producto.nombre, tallaSeleccionada, precioEfectivo)
    : null

  // ── Full product page ─────────────────────────────────────────────────────
  return (
    <div
      style={{ minHeight: '100vh', background: 'var(--color-base)' }}
      className="px-6 md:px-12 pt-36 md:pt-40 pb-24 lg:pb-32"
    >
      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-12 lg:gap-16 mb-24 lg:mb-32">

        {/* LEFT — Gallery */}
        <GaleriaProducto
          key={`${producto.id}-${colorSeleccionado ?? 'base'}`}
          imagenes={imagenesGaleria}
          nombre={producto.nombre}
        />

        {/* RIGHT — Info panel */}
        <div ref={infoPanelRef} className="flex flex-col gap-5 lg:pt-2">

          {/* Breadcrumb */}
          <nav
            data-animate
            className="flex items-center gap-2 flex-wrap"
            aria-label="Ruta de navegación"
          >
            <Link
              to="/catalogo"
              className="label-xs hover:underline underline-offset-2 transition-colors"
              style={{ color: 'var(--color-muted)' }}
            >
              Catálogo
            </Link>
            <span className="label-xs" style={{ color: 'var(--color-muted-soft)' }}>/</span>
            <Link
              to={`/catalogo?cat=${encodeURIComponent(producto.categoria)}`}
              className="label-xs capitalize hover:underline underline-offset-2 transition-colors"
              style={{ color: 'var(--color-muted)' }}
            >
              {producto.categoria}
            </Link>
            <span className="label-xs" style={{ color: 'var(--color-muted-soft)' }}>/</span>
            <span
              className="label-xs truncate"
              style={{ color: 'var(--color-ink)', maxWidth: '14rem' }}
            >
              {producto.nombre}
            </span>
          </nav>

          {/* Product name */}
          <h1
            data-animate
            className="font-serif font-light leading-none"
            style={{
              fontSize: 'clamp(2rem, 4.5vw, 3.8rem)',
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
            }}
          >
            {producto.nombre}
          </h1>

          {/* Price */}
          <div data-animate className="flex items-baseline gap-3">
            {hasOferta && (
              <p
                className="font-serif flex items-start line-through"
                style={{ color: '#dc2626', fontWeight: 400, opacity: 0.85 }}
              >
                <span
                  style={{ fontSize: '0.55rem', lineHeight: 1, marginTop: '0.4rem', marginRight: '0.1rem' }}
                >
                  &euro;
                </span>
                <span
                  style={{
                    fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)',
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {precioOrigInt}
                  <span style={{ fontSize: '0.8rem', marginLeft: '0.1rem' }}>
                    .{precioOrigDec}
                  </span>
                </span>
              </p>
            )}
            <p className="font-serif flex items-start" style={{ color: 'var(--color-accent-ink)' }}>
              <span
                style={{ fontSize: '0.7rem', lineHeight: 1, marginTop: '0.5rem', marginRight: '0.15rem' }}
              >
                &euro;
              </span>
              <span
                style={{
                  fontSize: 'clamp(2.2rem, 4vw, 3.2rem)',
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  fontWeight: 600,
                }}
              >
                {precioInt}
                <span style={{ fontSize: '1.1rem', marginLeft: '0.15rem', fontWeight: 400 }}>
                  .{precioDec}
                </span>
              </span>
            </p>
          </div>

          {/* Description */}
          {producto.descripcion && (
            <p
              data-animate
              className="font-sans font-light leading-relaxed"
              style={{ color: 'var(--color-muted)', fontSize: '0.9rem', maxWidth: '36ch' }}
            >
              {producto.descripcion}
            </p>
          )}

          {/* Divider */}
          <hr
            data-animate
            style={{ borderColor: 'var(--color-surface)', borderTopWidth: '1px' }}
          />

          {/* Color selector — only shown when the product has color variants */}
          {coloresDisponibles.length > 0 && (
            <div data-animate className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2">
                <p className="label-xs" style={{ color: 'var(--color-muted)' }}>
                  Color
                </p>
                {colorSeleccionado && (
                  <span
                    className="label-xs capitalize"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    · {coloresDisponibles.find((c) => c.id === colorSeleccionado)?.label}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap" style={{ gap: '0.6rem' }}>
                {coloresDisponibles.map((c) => {
                  // normalizeColores already resolves label/hex/border for both
                  // fixed catalog colors and custom colors — no getColorMeta needed
                  const active = colorSeleccionado === c.id
                  // Colors without their own stock fall back to the product's
                  // aggregate — same convention as tallasActivas above.
                  const agotadoColor = estaAgotado(c.tallas ?? producto.tallas)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setColorSeleccionado(c.id)
                        setTallaSeleccionada(null)
                      }}
                      title={agotadoColor ? `${c.label} — agotado` : c.label}
                      aria-label={`${c.label}${agotadoColor ? ' — agotado' : ''}`}
                      aria-pressed={active}
                      className="relative transition-all"
                      style={{
                        width: '2.35rem',
                        height: '2.35rem',
                        borderRadius: '9999px',
                        background: c.hex,
                        opacity: agotadoColor ? 0.35 : 1,
                        border: active
                          ? '2px solid var(--color-ink)'
                          : c.border
                            ? '1px solid rgba(0,0,0,0.2)'
                            : '1px solid transparent',
                        outline: active
                          ? '2px solid var(--color-base)'
                          : 'none',
                        outlineOffset: active ? '-4px' : '0',
                        cursor: 'pointer',
                      }}
                    >
                      {agotadoColor && (
                        <span
                          aria-hidden
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '9999px',
                            background:
                              'linear-gradient(to top right, transparent calc(50% - 1px), var(--color-ink) calc(50% - 1px), var(--color-ink) calc(50% + 1px), transparent calc(50% + 1px))',
                          }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Size selector */}
          <div data-animate className="flex flex-col gap-3">
            <p className="label-xs" style={{ color: 'var(--color-muted)' }}>
              Selecciona tu talla
            </p>
            <SelectorTalla
              tallas={tallasActivas}
              seleccionada={tallaSeleccionada}
              tipoTalla={producto.tipo_talla ?? 'ropa'}
              onChange={setTallaSeleccionada}
            />
            {tallaSeleccionada && (tallasActivas?.[tallaSeleccionada] ?? 0) <= 3 && (
              <p className="label-xs" style={{ color: 'var(--color-accent-ink)' }}>
                Últimas {tallasActivas[tallaSeleccionada]} unidades
              </p>
            )}
            {colorActivo && estaAgotado(tallasActivas) && !estaAgotado(producto.tallas) && (
              <p className="label-xs" style={{ color: 'var(--color-accent-ink)' }}>
                Agotado en este color — prueba otro color disponible
              </p>
            )}
          </div>

          {/* CTAs */}
          <div data-animate className="flex flex-col gap-3 mt-1">
            {/* Add to cart */}
            <button
              ref={btnAnadirRef}
              onClick={handleAddToCart}
              disabled={!tallaSeleccionada}
              data-cursor="link"
              data-cursor-label={tallaSeleccionada ? 'Añadir' : 'Talla'}
              className="w-full py-4 font-sans text-sm uppercase transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
              style={{
                background: tallaSeleccionada ? 'var(--color-ink)' : 'var(--color-surface)',
                color: tallaSeleccionada ? 'var(--color-base)' : 'var(--color-muted)',
                cursor: tallaSeleccionada ? 'pointer' : 'not-allowed',
                letterSpacing: '0.12em',
                willChange: 'transform',
              }}
            >
              {addedFeedback ? 'Añadido al carrito ✓' : 'Añadir al carrito'}
            </button>

            {/* WhatsApp CTA */}
            <a
              href={whatsappUrl ?? '#'}
              target={whatsappUrl ? '_blank' : undefined}
              rel="noreferrer"
              onClick={(e) => { if (!whatsappUrl) e.preventDefault() }}
              className="w-full py-4 text-center font-sans text-sm uppercase border transition-colors duration-200"
              style={{
                borderColor: 'var(--color-accent-ink)',
                color: whatsappUrl ? 'var(--color-accent-ink)' : 'var(--color-muted-soft)',
                pointerEvents: whatsappUrl ? 'auto' : 'none',
                opacity: whatsappUrl ? 1 : 0.45,
                letterSpacing: '0.12em',
                cursor: whatsappUrl ? 'pointer' : 'not-allowed',
              }}
            >
              Consultar por WhatsApp
            </a>

            {!tallaSeleccionada && (
              <p className="label-xs text-center" style={{ color: 'var(--color-muted)' }}>
                Selecciona una talla para continuar
              </p>
            )}
          </div>

          {/* Category + badges */}
          <div data-animate className="flex items-center gap-4 flex-wrap mt-1">
            <div className="flex items-center gap-2">
              <span className="label-xs" style={{ color: 'var(--color-muted)' }}>Categoría</span>
              <span className="label-xs" style={{ color: 'var(--color-muted-soft)' }}>—</span>
              <span className="label-xs capitalize" style={{ color: 'var(--color-accent-ink)' }}>
                {producto.categoria}
              </span>
            </div>
            {producto.mas_vendido && (
              <span className="label-xs" style={{ color: 'var(--color-accent-ink)' }}>Más vendido</span>
            )}
            {producto.destacado && (
              <span className="label-xs" style={{ color: 'var(--color-muted)' }}>Destacado</span>
            )}
          </div>
        </div>
      </div>

      {/* Related products */}
      {relacionados.length > 0 && (
        <section>
          <p className="label-xs mb-8" style={{ color: 'var(--color-muted)' }}>
            También te puede gustar
          </p>
          <ProductosRelacionados productos={relacionados} loading={false} />
        </section>
      )}
    </div>
  )
}

export default Producto
