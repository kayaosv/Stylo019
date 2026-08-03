import { useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useUIStore } from '@/store/useUIStore'

gsap.registerPlugin(useGSAP)

const NAV_ITEMS = [
  { label: 'Inicio', to: '/', number: '01' },
  { label: 'Catalogo', to: '/catalogo', number: '02' },
  { label: 'Contacto', to: '/contacto', number: '03' },
]

export const MobileMenu = () => {
  const open = useUIStore((s) => s.mobileMenuOpen)
  const closeMenu = useUIStore((s) => s.closeMobileMenu)
  const location = useLocation()

  const panelRef = useRef(null)
  const itemsRef = useRef([])
  const overlayRef = useRef(null)

  // Open / close timeline
  useGSAP(
    () => {
      if (!panelRef.current) return

      if (open) {
        gsap.set(panelRef.current, { display: 'flex' })
        const tl = gsap.timeline()
        tl.fromTo(
          overlayRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.4, ease: 'power2.out' }
        )
          .fromTo(
            panelRef.current,
            { yPercent: -100 },
            { yPercent: 0, duration: 0.7, ease: 'expo.out' },
            '-=0.3'
          )
          .fromTo(
            itemsRef.current,
            { yPercent: 110, opacity: 0 },
            {
              yPercent: 0,
              opacity: 1,
              duration: 0.8,
              ease: 'expo.out',
              stagger: 0.06,
            },
            '-=0.4'
          )
      } else {
        const tl = gsap.timeline({
          onComplete: () => {
            if (panelRef.current) panelRef.current.style.display = 'none'
          },
        })
        tl.to(itemsRef.current, {
          yPercent: 110,
          opacity: 0,
          duration: 0.35,
          ease: 'expo.in',
          stagger: { amount: 0.12, from: 'end' },
        })
          .to(
            panelRef.current,
            { yPercent: -100, duration: 0.55, ease: 'expo.in' },
            '-=0.15'
          )
          .to(overlayRef.current, { opacity: 0, duration: 0.3 }, '-=0.4')
      }
    },
    { dependencies: [open] }
  )

  // Close on route change
  useGSAP(
    () => {
      if (open) closeMenu()
    },
    { dependencies: [location.pathname] }
  )

  // Lock body scroll while menu open
  useGSAP(
    () => {
      if (open) {
        document.body.style.overflow = 'hidden'
      } else {
        document.body.style.overflow = ''
      }
      return () => {
        document.body.style.overflow = ''
      }
    },
    { dependencies: [open] }
  )

  return (
    <>
      {/* Overlay backdrop */}
      <div
        ref={overlayRef}
        onClick={closeMenu}
        aria-hidden
        className="fixed inset-0 z-[90] lg:hidden pointer-events-auto"
        style={{
          background: 'rgba(10, 37, 64, 0.4)',
          opacity: 0,
          display: open ? 'block' : 'none',
        }}
      />

      {/* Sliding panel */}
      <aside
        ref={panelRef}
        className="fixed inset-x-0 top-0 z-[95] lg:hidden flex-col"
        style={{
          display: 'none',
          minHeight: '100dvh',
          background: 'var(--color-base)',
          paddingTop: '6rem',
          paddingBottom: '4rem',
          paddingLeft: '1.5rem',
          paddingRight: '1.5rem',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Menú principal"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={closeMenu}
          aria-label="Cerrar menú"
          className="absolute top-8 right-6 label-xs"
          style={{ color: 'var(--color-ink)' }}
        >
          [ Cerrar ]
        </button>

        {/* Nav items — giant editorial */}
        <nav
          aria-label="Mobile primary"
          className="flex flex-col gap-6 mt-4 mb-auto"
        >
          {NAV_ITEMS.map((item, idx) => {
            const isActive = location.pathname === item.to
            return (
              <div key={item.to} className="overflow-hidden">
                <Link
                  ref={(el) => (itemsRef.current[idx] = el)}
                  to={item.to}
                  onClick={closeMenu}
                  className="block group"
                  data-cursor="link"
                >
                  <div className="flex items-baseline gap-3">
                    <sup
                      className="label-xs"
                      style={{
                        color: 'var(--color-muted)',
                        fontSize: '0.6rem',
                      }}
                    >
                      {item.number}
                    </sup>
                    <span
                      className={`font-serif font-light leading-none ${
                        isActive ? 'italic' : ''
                      }`}
                      style={{
                        fontSize: 'clamp(3rem, 14vw, 5.5rem)',
                        color: isActive
                          ? 'var(--color-accent-ink)'
                          : 'var(--color-ink)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                </Link>
              </div>
            )
          })}
        </nav>

        {/* Bottom meta */}
        <div className="flex flex-col gap-2 pt-10 border-t border-[var(--color-surface)]">
          <span className="label-xs text-[var(--color-muted)]">
            Calle Ciudad de Carlet, 10 &mdash; 41019 Sevilla
          </span>
          <span className="label-xs text-[var(--color-muted)]">
            658 509 332 &middot; @modastylo019
          </span>
          <span className="label-xs text-[var(--color-accent-ink)] mt-2">
            Est. MMXXIV
          </span>
        </div>
      </aside>
    </>
  )
}
