import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

gsap.registerPlugin(useGSAP)

const WHATSAPP_URL = 'https://wa.me/34638970807'

export const WhatsAppButton = () => {
  const rootRef = useRef(null)
  const ringRef = useRef(null)
  const labelRef = useRef(null)
  const dotRef = useRef(null)
  const iconRef = useRef(null)
  const [expanded, setExpanded] = useState(false)

  // Entry + idle pulse + rotation
  useGSAP(
    () => {
      const tl = gsap.timeline({ delay: 1.2 })

      tl.from(rootRef.current, {
        scale: 0.4,
        opacity: 0,
        duration: 1,
        ease: 'expo.out',
      })

      // Slow infinite rotation on the orbital ring text
      gsap.to(ringRef.current, {
        rotation: 360,
        duration: 22,
        ease: 'none',
        repeat: -1,
      })

      // Soft idle breathing on the dot
      gsap.to(dotRef.current, {
        scale: 1.35,
        opacity: 0.55,
        duration: 1.8,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      })
    },
    { scope: rootRef }
  )

  const handleEnter = () => {
    setExpanded(true)
    gsap.to(labelRef.current, {
      width: 'auto',
      opacity: 1,
      duration: 0.7,
      ease: 'expo.out',
    })
    gsap.to(iconRef.current, {
      rotate: -12,
      duration: 0.5,
      ease: 'expo.out',
    })
  }

  const handleLeave = () => {
    setExpanded(false)
    gsap.to(labelRef.current, {
      width: 0,
      opacity: 0,
      duration: 0.5,
      ease: 'expo.in',
    })
    gsap.to(iconRef.current, {
      rotate: 0,
      duration: 0.5,
      ease: 'expo.out',
    })
  }

  return (
    <a
      ref={rootRef}
      href={WHATSAPP_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Contactar por WhatsApp"
      data-cursor="link"
      data-cursor-label="Escribe a Stylo019"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="fixed bottom-8 right-8 z-40 group flex items-center"
      style={{ willChange: 'transform' }}
    >
      {/* Expanding label — slides in from the right */}
      <div
        ref={labelRef}
        className="overflow-hidden whitespace-nowrap opacity-0 flex items-center"
        style={{ width: 0 }}
      >
        <div className="flex items-center gap-3 pr-5 pl-2">
          <div className="flex flex-col leading-tight">
            <span
              className="label-xs text-[var(--color-muted)]"
              style={{ fontSize: '0.55rem' }}
            >
              Directo con la casa
            </span>
            <span
              className="font-serif italic font-light text-[var(--color-ink)]"
              style={{ fontSize: '1.05rem' }}
            >
              Escribenos
            </span>
          </div>
        </div>
      </div>

      {/* Button core */}
      <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Orbital SVG ring with rotating text */}
        <svg
          ref={ringRef}
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          style={{ transform: 'scale(1.45)' }}
        >
          <defs>
            <path
              id="wa-ring-path"
              d="M 50, 50 m -40, 0 a 40,40 0 1,1 80,0 a 40,40 0 1,1 -80,0"
            />
          </defs>
          <text
            fill="var(--color-accent)"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '7px',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
            }}
          >
            <textPath href="#wa-ring-path">
              Stylo019 — WhatsApp — 658 509 332 —
            </textPath>
          </text>
        </svg>

        {/* Core circle — noir with paper halo for contrast on any bg */}
        <div className="relative w-12 h-12 rounded-full bg-[var(--color-ink)] flex items-center justify-center shadow-[0_10px_40px_-10px_rgba(10,10,10,0.5)] ring-2 ring-[var(--color-paper)]/70 group-hover:bg-[var(--color-accent)] group-hover:ring-[var(--color-accent)] transition-colors duration-500">
          {/* Pulsing dot */}
          <span
            ref={dotRef}
            className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] group-hover:bg-[var(--color-base)]"
          />

          {/* Icon — minimalist whatsapp glyph */}
          <svg
            ref={iconRef}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-base)"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </div>
      </div>
    </a>
  )
}
