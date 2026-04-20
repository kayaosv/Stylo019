import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// Footer hero phrase — split into words for stagger
const HERO_PHRASE = ['Vestir', 'no', 'es', 'cubrir.']

export const Footer = () => {
  const rootRef = useRef(null)
  const heroRef = useRef(null)
  const wordsRef = useRef([])
  const lineRef = useRef(null)
  const yearRef = useRef(null)
  const markerRef = useRef(null)

  useGSAP(
    () => {
      if (!rootRef.current) return

      // Giant phrase reveals on scroll-in
      gsap.from(wordsRef.current, {
        yPercent: 110,
        opacity: 0,
        stagger: 0.08,
        duration: 1.3,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top 85%',
          once: true,
        },
      })

      // Thin line draws across
      gsap.from(lineRef.current, {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 1.6,
        ease: 'expo.inOut',
        scrollTrigger: {
          trigger: lineRef.current,
          start: 'top 90%',
          once: true,
        },
      })

      // Year counter subtle fade
      gsap.from(yearRef.current, {
        opacity: 0,
        y: 20,
        duration: 1,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: yearRef.current,
          start: 'top 90%',
          once: true,
        },
      })

      // Marker ticker — infinite rotation
      gsap.to(markerRef.current, {
        rotation: 360,
        duration: 28,
        ease: 'none',
        repeat: -1,
      })
    },
    { scope: rootRef }
  )

  return (
    <footer
      ref={rootRef}
      className="relative overflow-hidden bg-[var(--color-ink)] text-[var(--color-base)]"
    >
      {/* Meta top strip — asymmetric */}
      <div className="grid grid-cols-12 gap-4 px-6 md:px-10 pt-14 pb-6">
        <div className="col-span-6 md:col-span-3">
          <span className="label-xs text-[var(--color-muted-soft)]">
            /// Footer — NO.999
          </span>
        </div>
        <div className="hidden md:block col-span-5 col-start-6">
          <span className="label-xs text-[var(--color-surface)]">
            A Sevillian house of ready-to-wear — by appointment & online
          </span>
        </div>
        <div className="col-span-6 md:col-span-3 md:col-start-11 text-right">
          <span className="label-xs text-[var(--color-muted-soft)]">
            37.3886 N // 5.9823 W
          </span>
        </div>
      </div>

      {/* Giant editorial phrase — asymmetric, breaks grid */}
      <div
        ref={heroRef}
        className="relative px-6 md:px-10 pt-10 md:pt-20 pb-16 md:pb-28"
      >
        <div className="grid grid-cols-12 gap-y-2 items-end">
          {/* First word — left, giant */}
          <div className="col-span-12 md:col-span-7 overflow-hidden">
            <span
              ref={(el) => (wordsRef.current[0] = el)}
              className="block font-serif italic font-light text-[var(--color-base)]"
              style={{
                fontSize: 'clamp(4rem, 16vw, 18rem)',
                lineHeight: 0.82,
                letterSpacing: '-0.04em',
              }}
            >
              {HERO_PHRASE[0]}
            </span>
          </div>

          {/* Tiny label — off to the right at top */}
          <div className="hidden md:flex col-span-3 col-start-10 flex-col gap-1 pb-8">
            <span className="label-xs text-[var(--color-accent)]">
              Manifesto
            </span>
            <span
              className="font-sans font-light text-[var(--color-surface)]"
              style={{ fontSize: '0.78rem', lineHeight: 1.5 }}
            >
              Cada prenda es un gesto. Una eleccion. Una forma de habitar el
              dia.
            </span>
          </div>

          {/* Second line — offset right, smaller */}
          <div className="col-span-12 md:col-start-4 md:col-span-9 overflow-hidden mt-[-1vw]">
            <div className="flex items-baseline gap-[0.3em] flex-wrap">
              {HERO_PHRASE.slice(1).map((word, i) => (
                <span key={i} className="overflow-hidden inline-block">
                  <span
                    ref={(el) => (wordsRef.current[i + 1] = el)}
                    className={`block font-serif ${
                      word === 'cubrir.'
                        ? 'font-semibold text-[var(--color-accent)]'
                        : 'font-light text-[var(--color-base)]'
                    }`}
                    style={{
                      fontSize: 'clamp(4rem, 16vw, 18rem)',
                      lineHeight: 0.82,
                      letterSpacing: '-0.04em',
                    }}
                  >
                    {word}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Rotating marker — decorative breaking out */}
        <div
          ref={markerRef}
          className="hidden md:flex absolute top-16 right-10 w-28 h-28 items-center justify-center pointer-events-none"
        >
          <svg viewBox="0 0 120 120" className="w-full h-full">
            <defs>
              <path
                id="circle-path"
                d="M 60, 60 m -48, 0 a 48,48 0 1,1 96,0 a 48,48 0 1,1 -96,0"
              />
            </defs>
            <text
              fill="var(--color-surface)"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '9px',
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
              }}
            >
              <textPath href="#circle-path">
                Sevilla — Stylo019 — Av. Ildefonso Marañón Lavín — Since 2024 —
              </textPath>
            </text>
          </svg>
        </div>
      </div>

      {/* Divider line */}
      <div
        ref={lineRef}
        className="h-px bg-[var(--color-muted)] mx-6 md:mx-10"
      />

      {/* Columns — intentionally asymmetric widths */}
      <div className="grid grid-cols-12 gap-6 px-6 md:px-10 pt-14 pb-20">
        {/* Column 1 — Contact (wide) */}
        <div className="col-span-12 md:col-span-5 space-y-6">
          <span className="label-xs text-[var(--color-muted-soft)]">
            [01] Visit
          </span>
          <p
            className="font-serif font-light text-[var(--color-base)]"
            style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2.4rem)', lineHeight: 1.1 }}
          >
            Av. Ildefonso
            <br />
            Marañón Lavín, 9
            <br />
            <span className="italic text-[var(--color-surface)]">41019 Sevilla</span>
          </p>
          <div className="flex flex-col gap-1">
            <span className="label-xs text-[var(--color-muted-soft)]">
              Lun — Sab · 10:00 — 20:30
            </span>
            <span className="label-xs text-[var(--color-muted-soft)]">
              Dom · Cerrado
            </span>
          </div>
        </div>

        {/* Column 2 — Index (narrow) */}
        <div className="col-span-6 md:col-span-2 md:col-start-7 space-y-5">
          <span className="label-xs text-[var(--color-muted-soft)]">
            [02] Index
          </span>
          <ul className="flex flex-col gap-2.5">
            {[
              { label: 'Inicio', to: '/' },
              { label: 'Catalogo', to: '/catalogo' },
              { label: 'Contacto', to: '/contacto' },
            ].map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="font-serif font-light text-[var(--color-base)] hover:text-[var(--color-accent)] transition-colors"
                  style={{ fontSize: '1.1rem' }}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 3 — Direct (narrow, offset) */}
        <div className="col-span-6 md:col-span-2 md:col-start-9 space-y-5">
          <span className="label-xs text-[var(--color-muted-soft)]">
            [03] Direct
          </span>
          <ul className="flex flex-col gap-2.5">
            <li>
              <a
                href="https://wa.me/34658509332"
                target="_blank"
                rel="noreferrer"
                className="font-serif font-light text-[var(--color-base)] hover:text-[var(--color-accent)] transition-colors"
                style={{ fontSize: '1.1rem' }}
              >
                WhatsApp
              </a>
            </li>
            <li>
              <a
                href="https://instagram.com/modastylo019"
                target="_blank"
                rel="noreferrer"
                className="font-serif font-light text-[var(--color-base)] hover:text-[var(--color-accent)] transition-colors"
                style={{ fontSize: '1.1rem' }}
              >
                Instagram
              </a>
            </li>
            <li>
              <a
                href="https://www.tiktok.com/@moda.stylo019"
                target="_blank"
                rel="noreferrer"
                className="font-serif font-light text-[var(--color-base)] hover:text-[var(--color-accent)] transition-colors"
                style={{ fontSize: '1.1rem' }}
              >
                TikTok
              </a>
            </li>
            <li>
              <a
                href="mailto:modastylo019@gmail.com"
                className="font-serif font-light text-[var(--color-base)] hover:text-[var(--color-accent)] transition-colors"
                style={{ fontSize: '1.1rem' }}
              >
                Email
              </a>
            </li>
          </ul>
        </div>

        {/* Column 4 — Newsletter (narrow) */}
        <div className="col-span-12 md:col-span-3 md:col-start-11 space-y-4">
          <span className="label-xs text-[var(--color-muted-soft)]">
            [04] Letter
          </span>
          <p
            className="font-serif font-light italic text-[var(--color-surface)]"
            style={{ fontSize: '0.95rem', lineHeight: 1.4 }}
          >
            Novedades, en silencio. Una vez al mes.
          </p>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex items-center border-b border-[var(--color-muted)] pb-2"
          >
            <input
              type="email"
              placeholder="tu@email.com"
              className="flex-1 bg-transparent outline-none font-sans font-light text-[var(--color-base)] placeholder:text-[var(--color-muted-soft)]"
              style={{ fontSize: '0.85rem' }}
            />
            <button
              type="submit"
              className="label-xs text-[var(--color-accent)] hover:text-[var(--color-base)] transition-colors"
            >
              Enviar →
            </button>
          </form>
        </div>
      </div>

      {/* Bottom — gigantic year + copyright */}
      <div className="relative px-6 md:px-10 pt-6 pb-10">
        <div
          ref={yearRef}
          className="flex items-end justify-between gap-4 flex-wrap"
        >
          <span
            className="font-serif font-light text-[var(--color-base)] leading-[0.8]"
            style={{
              fontSize: 'clamp(6rem, 22vw, 26rem)',
              letterSpacing: '-0.05em',
            }}
          >
            20<span className="italic text-[var(--color-accent)]">26</span>
          </span>

          <div className="flex flex-col gap-1 pb-6 md:pb-12 text-right">
            <span className="label-xs text-[var(--color-muted-soft)]">
              © Stylo019
            </span>
            <span className="label-xs text-[var(--color-muted-soft)]">
              All rights reserved
            </span>
            <span className="label-xs text-[var(--color-muted-soft)]">
              Made in Sevilla
            </span>
          </div>
        </div>

        {/* Legal micro-line — bottom absolute */}
        <div className="flex justify-between items-center pt-6 mt-6 border-t border-[var(--color-muted)]/30 flex-wrap gap-2">
          <span className="label-xs text-[var(--color-muted-soft)]">
            CIF: 28753199W
          </span>
          <div className="flex gap-6">
            <Link
              to="/privacidad"
              className="label-xs text-[var(--color-muted-soft)] hover:text-[var(--color-accent)] transition-colors"
            >
              Privacidad
            </Link>
            <Link
              to="/cookies"
              className="label-xs text-[var(--color-muted-soft)] hover:text-[var(--color-accent)] transition-colors"
            >
              Cookies
            </Link>
            <Link
              to="/terminos"
              className="label-xs text-[var(--color-muted-soft)] hover:text-[var(--color-accent)] transition-colors"
            >
              Terminos
            </Link>
          </div>
          <span className="label-xs text-[var(--color-muted-soft)]">
            v1.0 — WhatsApp Order
          </span>
        </div>
      </div>
    </footer>
  )
}
