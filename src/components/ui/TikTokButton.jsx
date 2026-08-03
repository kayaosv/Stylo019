import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

gsap.registerPlugin(useGSAP)

const TIKTOK_URL = 'https://www.tiktok.com/@stylo019_'

export const TikTokButton = () => {
  const rootRef = useRef(null)
  const ringRef = useRef(null)
  const labelRef = useRef(null)
  const dotRef = useRef(null)
  const iconRef = useRef(null)
  const [, setExpanded] = useState(false)

  useGSAP(
    () => {
      const tl = gsap.timeline({ delay: 1.5 })

      tl.from(rootRef.current, {
        scale: 0.4,
        opacity: 0,
        duration: 1,
        ease: 'expo.out',
      })

      gsap.to(ringRef.current, {
        rotation: 360,
        duration: 26,
        ease: 'none',
        repeat: -1,
      })

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
      href={TIKTOK_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Ver en TikTok"
      data-cursor="link"
      data-cursor-label="Videos de Stylo019"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="fixed bottom-56 right-8 z-40 group flex items-center"
      style={{ willChange: 'transform' }}
    >
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
              En movimiento
            </span>
            <span
              className="font-serif italic font-light text-[var(--color-ink)]"
              style={{ fontSize: '1.05rem' }}
            >
              @stylo019_
            </span>
          </div>
        </div>
      </div>

      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg
          ref={ringRef}
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          style={{ transform: 'scale(1.45)' }}
        >
          <defs>
            <path
              id="tt-ring-path"
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
            <textPath href="#tt-ring-path">
              Stylo019 — TikTok — @stylo019_ —
            </textPath>
          </text>
        </svg>

        <div className="relative w-12 h-12 rounded-full bg-[var(--color-ink)] flex items-center justify-center shadow-[0_10px_40px_-10px_rgba(10,10,10,0.5)] ring-2 ring-[var(--color-paper)]/70 group-hover:bg-[var(--color-accent)] group-hover:ring-[var(--color-accent)] transition-colors duration-500">
          <span
            ref={dotRef}
            className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] group-hover:bg-[var(--color-base)]"
          />

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
            <path d="M21 8.5a5.5 5.5 0 0 1-5.5-5.5h-3v13.25a2.75 2.75 0 1 1-2.75-2.75c.28 0 .55.04.8.12v-3.04a5.75 5.75 0 1 0 4.95 5.67V9.4A8.5 8.5 0 0 0 21 11.4V8.5z" />
          </svg>
        </div>
      </div>
    </a>
  )
}
