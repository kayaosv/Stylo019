import { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useCartStore } from '@/store/useCartStore'
import { useUIStore } from '@/store/useUIStore'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// Navigation items — asymmetric, not a standard set
const NAV_ITEMS = [
  { label: 'Inicio', to: '/', number: '01' },
  { label: 'Catalogo', to: '/catalogo', number: '02' },
  { label: 'Contacto', to: '/contacto', number: '03' },
]

export const Header = ({ variant = 'default' }) => {
  const headerRef = useRef(null)
  const bgRef = useRef(null)
  const barRef = useRef(null)
  const serifRef = useRef(null)
  const sansRef = useRef(null)
  const navRef = useRef(null)
  const metaRef = useRef(null)
  const cartCountRef = useRef(null)
  const underlineRefs = useRef([])

  const [hoveredIdx, setHoveredIdx] = useState(null)
  const location = useLocation()

  const totalItems = useCartStore((s) => s.totalItems())
  const toggleCart = useUIStore((s) => s.toggleCart)
  const toggleMobileMenu = useUIStore((s) => s.toggleMobileMenu)

  // Entry animation
  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })

      tl.from(serifRef.current, {
        yPercent: 110,
        duration: 1.4,
      })
        .from(
          sansRef.current,
          { opacity: 0, x: -12, duration: 0.9 },
          '-=1.0'
        )
        .from(
          metaRef.current?.children || [],
          { opacity: 0, y: 12, stagger: 0.06, duration: 0.6 },
          '-=0.8'
        )
        .from(
          navRef.current?.querySelectorAll('[data-nav-item]') || [],
          { opacity: 0, y: 14, stagger: 0.08, duration: 0.7 },
          '-=0.6'
        )
    },
    { scope: headerRef }
  )

  // Scroll compression — header shrinks, serif shrinks, bg appears
  useGSAP(
    () => {
      if (!headerRef.current) return

      const st = ScrollTrigger.create({
        start: 0,
        end: 200,
        scrub: 0.6,
        onUpdate: (self) => {
          const p = self.progress
          gsap.to(barRef.current, {
            paddingTop: gsap.utils.interpolate(32, 14, p),
            paddingBottom: gsap.utils.interpolate(32, 14, p),
            duration: 0.3,
            overwrite: 'auto',
          })
          gsap.to(bgRef.current, {
            backgroundColor:
              p > 0.05
                ? 'rgba(236, 249, 255, 0.82)'
                : 'rgba(236, 249, 255, 0)',
            backdropFilter: p > 0.05 ? 'blur(14px)' : 'blur(0px)',
            duration: 0.3,
            overwrite: 'auto',
          })
          gsap.to(serifRef.current, {
            scale: gsap.utils.interpolate(1, 0.72, p),
            transformOrigin: 'left center',
            duration: 0.3,
            overwrite: 'auto',
          })
        },
      })

      return () => st.kill()
    },
    { scope: headerRef }
  )

  // Cart badge bump
  useGSAP(
    () => {
      if (!cartCountRef.current || totalItems === 0) return
      gsap.fromTo(
        cartCountRef.current,
        { scale: 0.4, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' }
      )
    },
    { dependencies: [totalItems] }
  )

  // Hover underline — GSAP draws from left
  const handleNavEnter = (idx) => {
    setHoveredIdx(idx)
    const el = underlineRefs.current[idx]
    if (!el) return
    gsap.fromTo(
      el,
      { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: 0.5, ease: 'expo.out' }
    )
  }

  const handleNavLeave = (idx) => {
    setHoveredIdx(null)
    const el = underlineRefs.current[idx]
    if (!el) return
    gsap.to(el, {
      scaleX: 0,
      transformOrigin: 'right center',
      duration: 0.4,
      ease: 'expo.in',
    })
  }

  return (
    <header
      ref={headerRef}
      className="fixed inset-x-0 top-9 z-50 pointer-events-none"
    >
      {/* Scroll-reactive background — covers meta bar + main bar */}
      <div
        ref={bgRef}
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor: 'rgba(236, 249, 255, 0)' }}
      />

      {/* Top meta bar — tiny text crossing the viewport */}
      <div
        ref={metaRef}
        className="hidden md:flex items-center justify-between px-8 pt-4 pointer-events-auto"
      >
        <span className="label-xs text-[var(--color-muted)]">
          Sevilla — 37.4117° N / 5.9272° W
        </span>
        <span className="label-xs text-[var(--color-muted)] tracking-[0.4em]">
          Calle Ciudad de Carlet, 10 — 41019
        </span>
        <span className="label-xs text-[var(--color-muted)]">
          Est. MMXXIV
        </span>
      </div>

      {/* Main bar */}
      <div
        ref={barRef}
        className="pointer-events-auto relative flex items-end justify-between gap-6 px-6 md:px-8 pt-8 pb-8 transition-colors"
      >
        {/* LOGO — brutal contrast */}
        <Link
          to="/"
          aria-label="Stylo019"
          className="group relative flex items-end gap-3 leading-none select-none"
          onClick={(e) => {
            if (location.pathname === '/') {
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
          }}
        >
          <div className="overflow-hidden">
            <span
              ref={serifRef}
              className="block font-serif font-semibold text-[var(--color-ink)]"
              style={{
                fontSize: 'clamp(3.2rem, 5.6vw, 6rem)',
                lineHeight: 0.8,
                letterSpacing: '-0.04em',
              }}
            >
              Stylo
            </span>
          </div>
          <div ref={sansRef} className="flex flex-col pb-1.5 md:pb-3">
            <span
              className="font-sans font-light text-[var(--color-muted)]"
              style={{
                fontSize: '0.78rem',
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
              }}
            >
              No
            </span>
            <span
              className="font-sans font-medium text-[var(--color-accent-ink)] tabular-nums"
              style={{
                fontSize: '0.78rem',
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
              }}
            >
              019
            </span>
          </div>
        </Link>

        {/* NAVIGATION — off-center, not perfectly centered */}
        <nav
          ref={navRef}
          className="hidden lg:flex items-end gap-10 absolute left-1/2 bottom-8 -translate-x-[42%]"
          aria-label="Primary"
        >
          {NAV_ITEMS.map((item, idx) => {
            const isActive = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                data-nav-item
                onMouseEnter={() => handleNavEnter(idx)}
                onMouseLeave={() => handleNavLeave(idx)}
                className="relative inline-flex items-baseline gap-1.5 group"
              >
                <sup
                  className="label-xs text-[var(--color-muted)]"
                  style={{ fontSize: '0.5rem' }}
                >
                  {item.number}
                </sup>
                <span
                  className={`font-serif font-light text-[var(--color-ink)] transition-colors ${
                    isActive ? 'italic' : ''
                  }`}
                  style={{
                    fontSize: '1.35rem',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {item.label}
                </span>
                <span
                  ref={(el) => (underlineRefs.current[idx] = el)}
                  className="absolute -bottom-1 left-0 right-0 h-px bg-[var(--color-ink)]"
                  style={{
                    transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
                    transformOrigin: 'left center',
                  }}
                />
              </Link>
            )
          })}
        </nav>

        {/* ACTIONS — search + cart */}
        <div className="flex items-center gap-5 md:gap-7">
          {/* Search — hidden on very small */}
          <button
            type="button"
            aria-label="Search"
            className="hidden sm:flex items-center gap-2 label-xs text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="hidden md:inline">Search</span>
          </button>

          {/* Cart */}
          <button
            type="button"
            onClick={toggleCart}
            aria-label="Open cart"
            className="relative flex items-baseline gap-1.5 group"
          >
            <span
              className="font-serif font-light text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors"
              style={{ fontSize: '1.15rem', letterSpacing: '-0.01em' }}
            >
              Cesta
            </span>
            <span
              className="label-xs text-[var(--color-muted)]"
              style={{ fontSize: '0.55rem' }}
            >
              [
              <span
                ref={cartCountRef}
                className="inline-block px-0.5 text-[var(--color-ink)] font-medium tabular-nums"
              >
                {String(totalItems).padStart(2, '0')}
              </span>
              ]
            </span>
          </button>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={toggleMobileMenu}
            aria-label="Open menu"
            className="lg:hidden flex flex-col gap-1.5"
          >
            <span className="block w-6 h-px bg-[var(--color-ink)]" />
            <span className="block w-4 h-px bg-[var(--color-ink)] self-end" />
          </button>
        </div>

      </div>
    </header>
  )
}
