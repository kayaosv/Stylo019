import { useRef, useState, useEffect } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { fetchCategorias } from '@/services/categorias'

gsap.registerPlugin(useGSAP)

const TALLAS = ['XS', 'S', 'M', 'L', 'XL']

// Editorial sticky sidebar — no card, no shadow, integrated into the cream background.
export const Filtros = ({ filtros, onChange, onLimpiar, totalResultados = 0 }) => {
  const containerRef = useRef(null)
  const tituloRef = useRef(null)
  const lineRef = useRef(null)

  const [categorias, setCategorias] = useState([])

  // Local state for price inputs (only commit on blur)
  const [precioMinLocal, setPrecioMinLocal] = useState(filtros?.precioMin ?? '')
  const [precioMaxLocal, setPrecioMaxLocal] = useState(filtros?.precioMax ?? '')

  useEffect(() => {
    fetchCategorias().then(({ data }) => setCategorias(data))
  }, [])

  // Sync if parent resets filters
  useEffect(() => {
    setPrecioMinLocal(filtros?.precioMin ?? '')
    setPrecioMaxLocal(filtros?.precioMax ?? '')
  }, [filtros?.precioMin, filtros?.precioMax])

  // Mount reveal — title overflow + line scaleX
  useGSAP(
    () => {
      const tl = gsap.timeline({ delay: 0.15 })

      tl.from(tituloRef.current, {
        yPercent: 110,
        duration: 0.9,
        ease: 'expo.out',
      }).from(
        lineRef.current,
        {
          scaleX: 0,
          duration: 0.8,
          ease: 'expo.out',
        },
        '-=0.55'
      )

      // Underline hover setup for category buttons
      const botones = containerRef.current?.querySelectorAll('[data-cat-btn]')
      botones?.forEach((btn) => {
        const underline = btn.querySelector('[data-cat-underline]')
        if (!underline) return
        const isActive = btn.dataset.active === 'true'
        if (isActive) return

        const enter = () =>
          gsap.to(underline, {
            scaleX: 1,
            duration: 0.45,
            ease: 'expo.out',
          })
        const leave = () =>
          gsap.to(underline, {
            scaleX: 0,
            duration: 0.35,
            ease: 'expo.in',
          })

        btn.addEventListener('mouseenter', enter)
        btn.addEventListener('mouseleave', leave)

        return () => {
          btn.removeEventListener('mouseenter', enter)
          btn.removeEventListener('mouseleave', leave)
        }
      })
    },
    { scope: containerRef, dependencies: [filtros?.categoria] }
  )

  // Toggle handlers
  const handleCategoria = (slug) => {
    onChange({ categoria: filtros?.categoria === slug ? null : slug })
  }

  const handleTalla = (talla) => {
    onChange({ tallaDisponible: filtros?.tallaDisponible === talla ? null : talla })
  }

  const commitPrecio = () => {
    const min = precioMinLocal === '' ? null : Number(precioMinLocal)
    const max = precioMaxLocal === '' ? null : Number(precioMaxLocal)
    onChange({ precioMin: min, precioMax: max })
  }

  const hayFiltrosActivos =
    !!filtros?.categoria ||
    !!filtros?.tallaDisponible ||
    filtros?.precioMin != null ||
    filtros?.precioMax != null

  return (
    <aside
      ref={containerRef}
      className="sticky top-32 flex flex-col gap-12 pr-4"
      aria-label="Filtros de catálogo"
    >
      {/* Title with overflow mask */}
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden">
          <h2
            ref={tituloRef}
            className="font-serif font-light text-[var(--color-ink)] leading-[0.9]"
            style={{
              fontSize: 'clamp(2.4rem, 4vw, 3.2rem)',
              letterSpacing: '-0.02em',
            }}
          >
            Filtrar
          </h2>
        </div>

        {/* Animated line */}
        <div
          ref={lineRef}
          className="h-px w-full"
          style={{
            background: 'var(--color-surface)',
            transformOrigin: 'left center',
          }}
        />

        {/* Results counter */}
        <p
          className="label-xs italic text-[var(--color-muted)]"
          style={{ letterSpacing: '0.08em' }}
        >
          ( {totalResultados} piezas )
        </p>
      </div>

      {/* Categorias */}
      <section className="flex flex-col gap-4">
        <span
          className="label-xs text-[var(--color-accent-ink)]"
          style={{ letterSpacing: '0.18em' }}
        >
          Coleccion
        </span>
        <ul className="flex flex-col gap-2.5">
          {categorias.map((cat) => {
            const activa = filtros?.categoria === cat.id
            return (
              <li key={cat.id}>
                <button
                  type="button"
                  data-cat-btn
                  data-active={activa ? 'true' : 'false'}
                  onClick={() => handleCategoria(cat.id)}
                  className="relative inline-block text-left font-serif font-light leading-tight"
                  style={{
                    fontSize: '1rem',
                    color: activa ? 'var(--color-ink)' : 'var(--color-muted)',
                    fontStyle: activa ? 'italic' : 'normal',
                    textDecoration: activa ? 'underline' : 'none',
                    textUnderlineOffset: '6px',
                    textDecorationThickness: '1px',
                  }}
                >
                  {cat.nombre}
                  {!activa && (
                    <span
                      data-cat-underline
                      className="absolute left-0 right-0 -bottom-1 h-px"
                      style={{
                        background: 'var(--color-ink)',
                        transform: 'scaleX(0)',
                        transformOrigin: 'left center',
                      }}
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Tallas */}
      <section className="flex flex-col gap-4">
        <span
          className="label-xs text-[var(--color-accent-ink)]"
          style={{ letterSpacing: '0.18em' }}
        >
          Talla
        </span>
        <div className="flex gap-1.5">
          {TALLAS.map((talla) => {
            const activa = filtros?.tallaDisponible === talla
            return (
              <button
                key={talla}
                type="button"
                onClick={() => handleTalla(talla)}
                aria-pressed={activa}
                className="font-sans font-medium flex items-center justify-center transition-colors duration-200"
                style={{
                  fontSize: '1.2rem',
                  width: '2.6rem',
                  height: '2.6rem',
                  color: activa ? 'var(--color-paper)' : 'var(--color-muted)',
                  background: activa ? 'var(--color-ink)' : 'transparent',
                  letterSpacing: '0.05em',
                }}
                onMouseEnter={(e) => {
                  if (!activa) e.currentTarget.style.color = 'var(--color-ink)'
                }}
                onMouseLeave={(e) => {
                  if (!activa) e.currentTarget.style.color = 'var(--color-muted)'
                }}
              >
                {talla}
              </button>
            )
          })}
        </div>
      </section>

      {/* Precio */}
      <section className="flex flex-col gap-4">
        <span
          className="label-xs text-[var(--color-accent-ink)]"
          style={{ letterSpacing: '0.18em' }}
        >
          Precio
        </span>
        <div className="flex items-end gap-3 font-serif font-light text-[var(--color-ink)]">
          <span
            className="text-[var(--color-muted)] pb-1"
            style={{ fontSize: '0.9rem' }}
          >
            &euro;
          </span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="0"
            aria-label="Precio minimo"
            value={precioMinLocal}
            onChange={(e) => setPrecioMinLocal(e.target.value)}
            onBlur={commitPrecio}
            className="w-16 bg-transparent outline-none border-b text-center pb-1"
            style={{
              borderColor: 'var(--color-surface)',
              fontSize: '1.1rem',
              color: 'var(--color-ink)',
            }}
          />
          <span className="pb-1 text-[var(--color-muted)]">&mdash;</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="500"
            aria-label="Precio maximo"
            value={precioMaxLocal}
            onChange={(e) => setPrecioMaxLocal(e.target.value)}
            onBlur={commitPrecio}
            className="w-16 bg-transparent outline-none border-b text-center pb-1"
            style={{
              borderColor: 'var(--color-surface)',
              fontSize: '1.1rem',
              color: 'var(--color-ink)',
            }}
          />
          <span
            className="text-[var(--color-muted)] pb-1"
            style={{ fontSize: '0.9rem' }}
          >
            &euro;
          </span>
        </div>
      </section>

      {/* Action buttons */}
      <div className="flex items-center gap-4" style={{ marginTop: '-0.5rem' }}>
        <button
          type="button"
          onClick={commitPrecio}
          className="label-xs border border-[var(--color-ink)] px-5 py-2.5 transition-colors duration-300"
          style={{
            color: 'var(--color-ink)',
            letterSpacing: '0.18em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-ink)'
            e.currentTarget.style.color = 'var(--color-paper)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--color-ink)'
          }}
        >
          Buscar
        </button>

        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={onLimpiar}
            className="label-xs transition-colors duration-300"
            style={{
              color: 'var(--color-accent-ink)',
              letterSpacing: '0.18em',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = 'var(--color-ink)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = 'var(--color-accent-ink)')
            }
          >
            Limpiar
          </button>
        )}
      </div>
    </aside>
  )
}
