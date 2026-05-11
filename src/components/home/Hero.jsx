import { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { HERO_PLACEHOLDER } from '@/lib/placeholderImages'
import { useMagnetic } from '@/hooks/useMagnetic'
import { fetchSetting } from '@/services/settings'

gsap.registerPlugin(useGSAP)

// Title words — stagger reveal on mount
const TITLE_WORDS = ['Moda', 'para', 'Ti.']

export const Hero = () => {
  const [heroSrc, setHeroSrc] = useState(null)
  const [imageReady, setImageReady] = useState(false)
  const [heroConfig, setHeroConfig] = useState({ maxHeight: '78vh', aspectRatio: '4/5', objectFit: 'cover' })

  useEffect(() => {
    Promise.all([
      fetchSetting('hero_image'),
      fetchSetting('hero_image_config'),
    ]).then(([{ data: img }, { data: cfg }]) => {
      setHeroSrc(img?.url || HERO_PLACEHOLDER)
      if (cfg) setHeroConfig((prev) => ({ ...prev, ...cfg }))
    })
  }, [])

  const rootRef = useRef(null)
  const imageRef = useRef(null)
  const labelRef = useRef(null)
  const wordsRef = useRef([])
  const descRef = useRef(null)
  const ctaRef = useRef(null)
  const ctaLineRef = useRef(null)
  const ctaMagneticRef = useMagnetic({ strength: 0.25 })
  const markerRef = useRef(null)
  const metaRef = useRef(null)

  useGSAP(
    () => {
      if (!imageReady) return
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })

      // Image reveals from bottom with clip-path
      tl.fromTo(
        imageRef.current,
        { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.1 },
        { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.8 }
      )
        // Eyebrow label fade
        .from(
          labelRef.current,
          { opacity: 0, y: 14, duration: 0.8 },
          '-=1.2'
        )
        // Title words stagger
        .from(
          wordsRef.current,
          { yPercent: 120, opacity: 0, duration: 1.3, stagger: 0.1 },
          '-=1.0'
        )
        // Description fade
        .from(
          descRef.current,
          { opacity: 0, y: 14, duration: 0.8 },
          '-=0.8'
        )
        // CTA fade
        .from(
          ctaRef.current,
          { opacity: 0, y: 14, duration: 0.8 },
          '-=0.6'
        )
        // Meta strip fade
        .from(
          metaRef.current?.children || [],
          { opacity: 0, y: 10, stagger: 0.06, duration: 0.6 },
          '-=0.6'
        )

      // Rotating marker — infinite
      if (markerRef.current) {
        gsap.to(markerRef.current, {
          rotation: 360,
          duration: 28,
          ease: 'none',
          repeat: -1,
        })
      }
    },
    { scope: rootRef, dependencies: [imageReady] }
  )

  // CTA underline hover — draws from left, retracts to right
  const handleCtaEnter = () => {
    gsap.fromTo(
      ctaLineRef.current,
      { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: 0.5, ease: 'expo.out' }
    )
  }

  const handleCtaLeave = () => {
    gsap.to(ctaLineRef.current, {
      scaleX: 0,
      transformOrigin: 'right center',
      duration: 0.4,
      ease: 'expo.in',
    })
  }

  return (
    <section
      ref={rootRef}
      className="relative overflow-hidden bg-[var(--color-base)]"
      style={{ minHeight: '100vh' }}
    >
      {/* Top meta strip — editorial numbers / location */}

      <div
        ref={metaRef}
        className="relative z-20 grid grid-cols-12 gap-4 px-6 md:px-10 pt-28 md:pt-36"
      >
        <div className="col-span-6 md:col-span-3" />
        <div className="col-span-6 md:col-span-3 md:col-start-10 text-right" />
      </div>

      {/* Main grid — asymmetric split */}
      <div className="relative grid grid-cols-12 gap-6 px-6 md:px-10 pt-10 md:pt-14 pb-20 md:pb-28">
        {/* Image — left column, breaks upward */}
        <div className="col-span-12 md:col-span-7 md:col-start-1 relative">
          <div
            className="relative w-full overflow-hidden"
            style={{
              aspectRatio: heroConfig.aspectRatio,
              maxHeight: heroConfig.maxHeight,
              background: 'var(--color-surface)',
            }}
          >
            <img
              ref={imageRef}
              src={heroSrc}
              alt="ModaMariaJose — Stylo019 Sevilla"
              className="absolute inset-0 w-full h-full will-change-transform"
              style={{ objectFit: heroConfig.objectFit, transformOrigin: 'center center' }}
              onLoad={() => setImageReady(true)}
            />
            {/* Corner editorial numbers — overlay on image */}
            <span
              className="label-xs absolute top-4 left-4 text-[var(--color-paper)] mix-blend-difference"
              style={{ letterSpacing: '0.3em' }}
            >
              Lookbook / 001
            </span>
            <span
              className="label-xs absolute bottom-4 right-4 text-[var(--color-paper)] mix-blend-difference"
              style={{ letterSpacing: '0.3em' }}
            >
              Sevilla — MMXXVI
            </span>
          </div>
        </div>

        {/* Text — right column, shifted */}
        <div className="col-span-12 md:col-span-5 md:col-start-8 flex flex-col justify-end gap-8 md:gap-10 pt-8 md:pt-0">
          <span
            ref={labelRef}
            className="label-xs text-[var(--color-muted)]"
          >
            [01] / Stylo019 - Sevilla
          </span>

          {/* Title — word stagger */}
          <h1
            className="flex flex-wrap items-baseline gap-x-[0.25em] gap-y-2"
            style={{ fontSize: 'clamp(3.2rem, 7.8vw, 8rem)' }}
          >
            {TITLE_WORDS.map((word, i) => (
              <span
                key={i}
                className="overflow-hidden inline-block"
                style={{ lineHeight: 0.82 }}
              >
                <span
                  ref={(el) => (wordsRef.current[i] = el)}
                  className={`block font-serif ${
                    word === 'Ti.'
                      ? 'italic font-light text-[var(--color-accent-ink)]'
                      : 'font-light text-[var(--color-ink)]'
                  }`}
                  style={{
                    fontSize: 'clamp(3.2rem, 7.8vw, 8rem)',
                    lineHeight: 0.82,
                    letterSpacing: '-0.035em',
                  }}
                >
                  {word}
                </span>
              </span>
            ))}
          </h1>

          <p
            ref={descRef}
            className="font-serif font-light text-[var(--color-muted)] max-w-sm"
            style={{
              fontSize: 'clamp(1.1rem, 1.5vw, 1.4rem)',
              lineHeight: 1.45,
            }}
          >
            Somos una tienda online del Barrio Parque Alcosa.
          </p>

          {/* CTA with animated underline + magnetic hover */}
          <div ref={ctaRef} className="flex items-center gap-4">
            <Link
              ref={ctaMagneticRef}
              to="/catalogo"
              onMouseEnter={handleCtaEnter}
              onMouseLeave={handleCtaLeave}
              data-cursor="link"
              data-cursor-label="Stylo019"
              className="relative inline-flex items-baseline gap-3 group"
            >
              <span
                className="font-serif font-light text-[var(--color-ink)]"
                style={{
                  fontSize: '1.5rem',
                  letterSpacing: '-0.01em',
                }}
              >
                Ver coleccion
              </span>
              <span
                className="font-serif text-[var(--color-accent-ink)]"
                style={{ fontSize: '1.5rem', lineHeight: 1 }}
                aria-hidden
              >
                &rarr;
              </span>
              <span
                ref={ctaLineRef}
                className="absolute -bottom-1 left-0 right-0 h-px bg-[var(--color-ink)]"
                style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }}
              />
            </Link>
          </div>
        </div>

        {/* Rotating marker — decorative, breaks grid */}
        <div
          ref={markerRef}
          className="hidden md:flex absolute top-6 right-10 w-28 h-28 items-center justify-center pointer-events-none"
        >
          <svg viewBox="0 0 120 120" className="w-full h-full">
            <defs>
              <path
                id="hero-circle-path"
                d="M 60, 60 m -48, 0 a 48,48 0 1,1 96,0 a 48,48 0 1,1 -96,0"
              />
            </defs>
            <text
              fill="var(--color-ink)"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '9px',
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
              }}
            >
              <textPath href="#hero-circle-path">
                Stylo019 — Av. Ildefonso Marañón Lavín — Since 2024 —
              </textPath>
            </text>
          </svg>
        </div>
      </div>
    </section>
  )
}
