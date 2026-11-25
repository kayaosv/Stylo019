import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Filtros } from '@/components/catalogo/Filtros'

gsap.registerPlugin(useGSAP)

// Mobile drawer that wraps the same Filtros component used on desktop.
export const FiltrosDrawer = ({
  open,
  onClose,
  filtros,
  onChange,
  onLimpiar,
  totalResultados,
}) => {
  const overlayRef = useRef(null)
  const panelRef = useRef(null)

  useGSAP(
    () => {
      if (!panelRef.current) return

      if (open) {
        gsap.set(panelRef.current, { display: 'flex' })
        gsap.set(overlayRef.current, { display: 'block' })
        const tl = gsap.timeline()
        tl.fromTo(
          overlayRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.35, ease: 'power2.out' }
        ).fromTo(
          panelRef.current,
          { xPercent: -100 },
          { xPercent: 0, duration: 0.6, ease: 'expo.out' },
          '-=0.25'
        )
      } else {
        const tl = gsap.timeline({
          onComplete: () => {
            if (panelRef.current) panelRef.current.style.display = 'none'
            if (overlayRef.current) overlayRef.current.style.display = 'none'
          },
        })
        tl.to(panelRef.current, {
          xPercent: -100,
          duration: 0.45,
          ease: 'expo.in',
        }).to(
          overlayRef.current,
          { opacity: 0, duration: 0.3 },
          '-=0.25'
        )
      }
    },
    { dependencies: [open] }
  )

  // Lock body scroll while drawer open
  useGSAP(
    () => {
      document.body.style.overflow = open ? 'hidden' : ''
      return () => {
        document.body.style.overflow = ''
      }
    },
    { dependencies: [open] }
  )

  return (
    <>
      <div
        ref={overlayRef}
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-[88] lg:hidden"
        style={{
          background: 'rgba(10, 37, 64, 0.4)',
          display: 'none',
          opacity: 0,
        }}
      />

      <aside
        ref={panelRef}
        className="fixed inset-y-0 left-0 z-[92] lg:hidden flex-col overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Filtros del catálogo"
        style={{
          display: 'none',
          width: 'min(86vw, 22rem)',
          background: 'var(--color-base)',
          paddingTop: '5rem',
          paddingBottom: 'calc(3rem + env(safe-area-inset-bottom))',
          height: '100dvh',
          overscrollBehavior: 'contain',
          paddingLeft: '1.5rem',
          paddingRight: '1.5rem',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar filtros"
          className="absolute top-6 right-5 label-xs"
          style={{ color: 'var(--color-ink)' }}
        >
          [ Cerrar ]
        </button>

        <Filtros
          enDrawer
          filtros={filtros}
          onChange={onChange}
          onLimpiar={onLimpiar}
          totalResultados={totalResultados}
        />
      </aside>
    </>
  )
}
