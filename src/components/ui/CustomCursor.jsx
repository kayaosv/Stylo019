import { useEffect, useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

gsap.registerPlugin(useGSAP)

// Detect coarse pointers (touch devices) and reduced motion preference
const canShowCursor = () => {
  if (typeof window === 'undefined') return false
  const finePointer = window.matchMedia('(pointer: fine)').matches
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches
  return finePointer && !reduceMotion
}

// Selectors that change cursor variant
const HOVERABLE_SELECTOR =
  'a, button, [role="button"], input, textarea, select, [data-cursor]'

export const CustomCursor = () => {
  const dotRef = useRef(null)
  const ringRef = useRef(null)
  const labelRef = useRef(null)

  // High-frequency tween setters built once
  const dotXTo = useRef(null)
  const dotYTo = useRef(null)
  const ringXTo = useRef(null)
  const ringYTo = useRef(null)

  useGSAP(
    () => {
      if (!canShowCursor()) return

      // Hide native cursor on the document
      document.documentElement.classList.add('has-custom-cursor')

      // Initial state
      gsap.set([dotRef.current, ringRef.current, labelRef.current], {
        xPercent: -50,
        yPercent: -50,
      })

      dotXTo.current = gsap.quickTo(dotRef.current, 'x', {
        duration: 0.09,
        ease: 'power3.out',
      })
      dotYTo.current = gsap.quickTo(dotRef.current, 'y', {
        duration: 0.09,
        ease: 'power3.out',
      })
      ringXTo.current = gsap.quickTo(ringRef.current, 'x', {
        duration: 0.28,
        ease: 'power3.out',
      })
      ringYTo.current = gsap.quickTo(ringRef.current, 'y', {
        duration: 0.28,
        ease: 'power3.out',
      })

      // Label follows the ring (slightly delayed)
      const labelXTo = gsap.quickTo(labelRef.current, 'x', {
        duration: 0.28,
        ease: 'power3.out',
      })
      const labelYTo = gsap.quickTo(labelRef.current, 'y', {
        duration: 0.28,
        ease: 'power3.out',
      })

      const handleMove = (e) => {
        dotXTo.current(e.clientX)
        dotYTo.current(e.clientY)
        ringXTo.current(e.clientX)
        ringYTo.current(e.clientY)
        labelXTo(e.clientX)
        labelYTo(e.clientY)
      }

      const handleHoverEnter = (e) => {
        const target = e.target.closest(HOVERABLE_SELECTOR)
        if (!target) return

        const label = target.getAttribute('data-cursor-label')
        const variant = target.getAttribute('data-cursor') || 'link'

        gsap.to(ringRef.current, {
          scale: variant === 'view' ? 2.6 : 1.9,
          borderColor: 'var(--color-accent-ink)',
          duration: 0.4,
          ease: 'expo.out',
        })
        gsap.to(dotRef.current, {
          scale: 0,
          duration: 0.3,
          ease: 'expo.out',
        })

        if (label) {
          labelRef.current.textContent = label
          gsap.to(labelRef.current, {
            opacity: 1,
            scale: 1,
            duration: 0.4,
            ease: 'expo.out',
          })
        }
      }

      const handleHoverLeave = (e) => {
        const target = e.target.closest(HOVERABLE_SELECTOR)
        if (!target) return

        gsap.to(ringRef.current, {
          scale: 1,
          borderColor: 'var(--color-ink)',
          duration: 0.4,
          ease: 'expo.out',
        })
        gsap.to(dotRef.current, {
          scale: 1,
          duration: 0.3,
          ease: 'expo.out',
        })
        gsap.to(labelRef.current, {
          opacity: 0,
          scale: 0.6,
          duration: 0.25,
          ease: 'expo.in',
        })
      }

      const handleMouseDown = () => {
        gsap.to(ringRef.current, {
          scale: 0.7,
          duration: 0.18,
          ease: 'power2.out',
        })
      }
      const handleMouseUp = () => {
        gsap.to(ringRef.current, {
          scale: 1,
          duration: 0.3,
          ease: 'expo.out',
        })
      }

      const handleLeaveWindow = () => {
        gsap.to([dotRef.current, ringRef.current], {
          opacity: 0,
          duration: 0.3,
        })
      }
      const handleEnterWindow = () => {
        gsap.to([dotRef.current, ringRef.current], {
          opacity: 1,
          duration: 0.3,
        })
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseover', handleHoverEnter)
      window.addEventListener('mouseout', handleHoverLeave)
      window.addEventListener('mousedown', handleMouseDown)
      window.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('mouseleave', handleLeaveWindow)
      document.addEventListener('mouseenter', handleEnterWindow)

      return () => {
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseover', handleHoverEnter)
        window.removeEventListener('mouseout', handleHoverLeave)
        window.removeEventListener('mousedown', handleMouseDown)
        window.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('mouseleave', handleLeaveWindow)
        document.removeEventListener('mouseenter', handleEnterWindow)
        document.documentElement.classList.remove('has-custom-cursor')
      }
    },
    { dependencies: [] }
  )

  // Skip rendering on touch / reduced-motion entirely
  useEffect(() => {
    if (!canShowCursor() && dotRef.current) {
      dotRef.current.style.display = 'none'
      ringRef.current.style.display = 'none'
      labelRef.current.style.display = 'none'
    }
  }, [])

  return (
    <>
      {/* Outer ring — slow follow */}
      <div
        ref={ringRef}
        aria-hidden
        className="fixed top-0 left-0 z-[200] pointer-events-none rounded-full"
        style={{
          width: '32px',
          height: '32px',
          border: '1px solid var(--color-ink)',
          mixBlendMode: 'difference',
          willChange: 'transform',
        }}
      />
      {/* Inner dot — fast follow */}
      <div
        ref={dotRef}
        aria-hidden
        className="fixed top-0 left-0 z-[201] pointer-events-none rounded-full"
        style={{
          width: '5px',
          height: '5px',
          background: 'var(--color-ink)',
          mixBlendMode: 'difference',
          willChange: 'transform',
        }}
      />
      {/* Floating label — appears next to cursor on data-cursor-label elements */}
      <div
        ref={labelRef}
        aria-hidden
        className="fixed top-0 left-0 z-[202] pointer-events-none label-xs whitespace-nowrap"
        style={{
          opacity: 0,
          marginTop: '36px',
          marginLeft: '36px',
          color: 'var(--color-paper)',
          background: 'var(--color-ink)',
          padding: '4px 10px',
          willChange: 'transform, opacity',
        }}
      />
    </>
  )
}
