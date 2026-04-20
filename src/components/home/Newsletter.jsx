import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { subscribeEmail } from '@/services/subscribers'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// Editorial phrase — split into words for stagger
const PHRASE = ['TÚ', 'estilo,', 'TÚ', 'talla,', 'TÚ.']

// Words that represent the pronoun "TÚ" — painted in accent
const ACCENT_WORDS = new Set(['TÚ', 'TÚ.'])

// Basic email shape validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const Newsletter = () => {
  const rootRef = useRef(null)
  const wordsRef = useRef([])
  const lineRef = useRef(null)
  const formRef = useRef(null)
  const successRef = useRef(null)
  const eyebrowRef = useRef(null)

  const [email, setEmail] = useState('')
  // status: idle | loading | error | success
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('Introduce un email valido')

  useGSAP(
    () => {
      if (!rootRef.current) return

      // Phrase word reveal
      gsap.from(wordsRef.current, {
        yPercent: 120,
        opacity: 0,
        stagger: 0.07,
        duration: 1.3,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top 78%',
          once: true,
        },
      })

      // Eyebrow + form column fade-in
      gsap.from([eyebrowRef.current, formRef.current], {
        opacity: 0,
        y: 20,
        duration: 1,
        ease: 'expo.out',
        stagger: 0.1,
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top 75%',
          once: true,
        },
      })

      // Bottom divider line
      gsap.from(lineRef.current, {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 1.6,
        ease: 'expo.inOut',
        scrollTrigger: {
          trigger: lineRef.current,
          start: 'top 92%',
          once: true,
        },
      })
    },
    { scope: rootRef }
  )

  const shakeForm = () => {
    gsap.fromTo(
      formRef.current,
      { x: 0 },
      {
        x: 0,
        keyframes: [
          { x: -8 },
          { x: 8 },
          { x: -4 },
          { x: 4 },
          { x: 0 },
        ],
        duration: 0.5,
        ease: 'power2.out',
      }
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (status === 'loading') return

    if (!EMAIL_REGEX.test(email.trim())) {
      setErrorMsg('Introduce un email valido')
      setStatus('error')
      shakeForm()
      return
    }

    setStatus('loading')

    const result = await subscribeEmail({ email, source: 'footer' })

    if (!result.ok) {
      if (result.reason === 'duplicate') {
        setErrorMsg('Este email ya esta suscrito')
      } else {
        setErrorMsg('Algo ha fallado, intentalo de nuevo')
      }
      setStatus('error')
      shakeForm()
      return
    }

    setStatus('success')
    setEmail('')

    // Swap form → success message
    const tl = gsap.timeline()
    tl.to(formRef.current, {
      opacity: 0,
      y: -10,
      duration: 0.4,
      ease: 'expo.in',
    })
      .set(successRef.current, { display: 'block' })
      .fromTo(
        successRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }
      )
      // Return to form after 3.5s
      .to(successRef.current, {
        opacity: 0,
        y: -10,
        duration: 0.4,
        ease: 'expo.in',
        delay: 3.5,
      })
      .set(successRef.current, { display: 'none' })
      .to(formRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: 'expo.out',
        onComplete: () => setStatus('idle'),
      })
  }

  return (
    <section
      ref={rootRef}
      className="relative bg-[var(--color-ink)] text-[var(--color-base)] px-6 md:px-10 pt-24 md:pt-32 pb-24 md:pb-32 overflow-hidden"
    >
      {/* Top meta strip */}
      <div className="grid grid-cols-12 gap-4 mb-10 md:mb-16">
        <div
          ref={eyebrowRef}
          className="col-span-12 md:col-span-6"
        >
          <span className="label-xs text-[var(--color-accent)]">
            [03] / Letter
          </span>
        </div>
        <div className="hidden md:block col-span-5 col-start-8 text-right">
          <span className="label-xs text-[var(--color-muted-soft)]">
            Una vez al mes — en silencio
          </span>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-6 items-end">
        {/* Left — giant editorial phrase */}
        <div className="col-span-12 md:col-span-8">
          <h3
            className="flex flex-nowrap items-baseline gap-x-[0.25em]"
            style={{ fontSize: 'clamp(2.2rem, 5vw, 5rem)' }}
          >
            {PHRASE.map((word, i) => (
              <span
                key={i}
                className="overflow-hidden inline-block"
                style={{ lineHeight: 0.88 }}
              >
                <span
                  ref={(el) => (wordsRef.current[i] = el)}
                  className="block font-serif font-light"
                  style={{
                    fontSize: 'clamp(2.2rem, 5vw, 5rem)',
                    lineHeight: 0.88,
                    letterSpacing: '-0.03em',
                    color: ACCENT_WORDS.has(word)
                      ? '#1CB6FE'
                      : 'var(--color-base)',
                  }}
                >
                  {word}
                </span>
              </span>
            ))}
          </h3>
        </div>

        {/* Right — form (or success message) */}
        <div className="col-span-12 md:col-span-4 md:col-start-9 relative">
          {/* Success message — absolute, hidden by default */}
          <div
            ref={successRef}
            className="absolute inset-0 flex flex-col gap-2 pointer-events-none"
            style={{ display: 'none' }}
          >
            <span className="label-xs text-[var(--color-accent)]">
              Gracias
            </span>
            <p
              className="font-serif italic font-light text-[var(--color-base)]"
              style={{ fontSize: '1.35rem', lineHeight: 1.3 }}
            >
              Pronto tendras noticias.
            </p>
          </div>

          {/* Form */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            <p
              className="font-serif font-light italic text-[var(--color-surface)]"
              style={{ fontSize: '1rem', lineHeight: 1.4 }}
            >
              Unete a nuestro circulo. Novedades y piezas exclusivas, solo
              para ti.
            </p>
            <div
              className={`flex items-center border-b pb-2 transition-colors ${
                status === 'error'
                  ? 'border-[var(--color-accent)]'
                  : 'border-[var(--color-muted)]'
              }`}
            >
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (status === 'error') setStatus('idle')
                }}
                className="flex-1 bg-transparent outline-none font-sans font-light text-[var(--color-base)] placeholder:text-[var(--color-muted-soft)]"
                style={{ fontSize: '0.95rem' }}
                aria-label="Email"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="label-xs text-[var(--color-accent)] hover:text-[var(--color-base)] transition-colors pl-4 disabled:opacity-50"
              >
                {status === 'loading' ? 'Enviando…' : 'Unirse \u2192'}
              </button>
            </div>
            {status === 'error' && (
              <span
                className="label-xs text-[var(--color-accent)]"
                role="alert"
              >
                {errorMsg}
              </span>
            )}
          </form>
        </div>
      </div>

      {/* Bottom divider */}
      <div
        ref={lineRef}
        className="h-px bg-[var(--color-muted)] mt-20 md:mt-28"
      />

      {/* Bottom micro-label */}
      <div className="flex justify-between items-center pt-6 flex-wrap gap-2">
        <span className="label-xs text-[var(--color-muted-soft)]">
          Sin spam. Solo piezas.
        </span>
        <span className="label-xs text-[var(--color-muted-soft)]">
          // NO.003
        </span>
      </div>
    </section>
  )
}
