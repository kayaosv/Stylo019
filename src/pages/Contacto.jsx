import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { subscribeEmail } from '@/services/subscribers'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// Hero title split into words for stagger reveal
const TITLE_WORDS = ['Escribenos', 'o', 'visitanos.']

// Business info — single source of truth for this page
const SHOP = {
  address: 'Calle Ciudad de Carlet, 10 — Local 2',
  city: 'Parque Alcosa, 41019 Sevilla',
  hours: [
    ['Lun – Sab', '10:00 – 20:30'],
    ['Domingo', 'Cerrado'],
  ],
  whatsapp: '34658509332',
  whatsappMessage: 'Hola, me gustaria hacer una consulta.',
  instagram: '@modastylo019',
  instagramUrl: 'https://instagram.com/modastylo019',
  tiktok: '@stylo019_',
  tiktokUrl: 'https://www.tiktok.com/@stylo019_',
  email: 'modastylo019@gmail.com',
  coords: { lat: 37.41174, lng: -5.92721 },
  // Google Business Profile — links straight to the real listing (reviews,
  // photos, hours) instead of a generic "search this address" query.
  mapsUrl: 'https://share.google/L7NbwWcmtigtYCxEW',
}

// Static Google Maps embed — no API key, no tracking beyond the iframe itself.
// A share.google link can't be used as an iframe src (redirects through a JS
// interstitial), so the embed still resolves the address as plain text.
const MAP_EMBED_URL =
  'https://maps.google.com/maps?q=Calle+Ciudad+de+Carlet+10,+41019+Sevilla,+Espana&t=&z=17&ie=UTF8&iwloc=&output=embed'

export const Contacto = () => {
  const rootRef = useRef(null)
  const wordsRef = useRef([])
  const eyebrowRef = useRef(null)
  const formRef = useRef(null)
  const infoRef = useRef(null)
  const mapRef = useRef(null)
  const whatsappLineRef = useRef(null)
  const instagramLineRef = useRef(null)
  const tiktokLineRef = useRef(null)
  const emailLineRef = useRef(null)

  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  // status: idle | loading | success | error
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  useGSAP(
    () => {
      // Hero title word reveal
      gsap.from(wordsRef.current, {
        yPercent: 120,
        opacity: 0,
        stagger: 0.08,
        duration: 1.3,
        ease: 'expo.out',
      })

      // Eyebrow fade
      gsap.from(eyebrowRef.current, {
        opacity: 0,
        y: 14,
        duration: 0.9,
        ease: 'expo.out',
        delay: 0.1,
      })

      // Form + info block fade-in on scroll
      gsap.from([formRef.current, infoRef.current], {
        opacity: 0,
        y: 30,
        stagger: 0.12,
        duration: 1,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: formRef.current,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        },
      })

      // Map reveal with clip-path
      gsap.fromTo(
        mapRef.current,
        { clipPath: 'inset(100% 0% 0% 0%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 1.6,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: mapRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        }
      )
    },
    { scope: rootRef }
  )

  // Underline hover — shared handler for the info links
  const makeHoverHandlers = (ref) => ({
    onMouseEnter: () => {
      gsap.fromTo(
        ref.current,
        { scaleX: 0, transformOrigin: 'left center' },
        { scaleX: 1, duration: 0.5, ease: 'expo.out' }
      )
    },
    onMouseLeave: () => {
      gsap.to(ref.current, {
        scaleX: 0,
        transformOrigin: 'right center',
        duration: 0.4,
        ease: 'expo.in',
      })
    },
  })

  const shake = () => {
    gsap.fromTo(
      formRef.current,
      { x: 0 },
      {
        x: 0,
        keyframes: [{ x: -8 }, { x: 8 }, { x: -4 }, { x: 4 }, { x: 0 }],
        duration: 0.5,
        ease: 'power2.out',
      }
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (status === 'loading') return

    setStatus('loading')
    setMessage('')

    const result = await subscribeEmail({
      email,
      nombre,
      source: 'contact',
    })

    if (result.ok) {
      setStatus('success')
      setMessage('Gracias. Te escribiremos pronto.')
      setEmail('')
      setNombre('')
      return
    }

    setStatus('error')
    if (result.reason === 'invalid') {
      setMessage('Introduce un email valido.')
    } else if (result.reason === 'duplicate') {
      setMessage('Este email ya esta suscrito.')
    } else {
      setMessage('Algo ha fallado. Intentalo de nuevo.')
    }
    shake()
  }

  const whatsappHref = `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(
    SHOP.whatsappMessage
  )}`

  const whatsappHover = makeHoverHandlers(whatsappLineRef)
  const instagramHover = makeHoverHandlers(instagramLineRef)
  const tiktokHover = makeHoverHandlers(tiktokLineRef)
  const emailHover = makeHoverHandlers(emailLineRef)

  return (
    <section
      ref={rootRef}
      className="relative bg-[var(--color-base)] overflow-hidden"
      style={{ minHeight: '100vh' }}
    >
      {/* Top meta strip */}
      <div className="relative z-20 grid grid-cols-12 gap-4 px-6 md:px-10 pt-28 md:pt-36">
        <div className="col-span-6 md:col-span-3">
          <span
            ref={eyebrowRef}
            className="label-xs text-[var(--color-muted)]"
          >
            /// Contacto — NO.007
          </span>
        </div>
        <div className="hidden md:block col-span-5 col-start-6 text-center">
          <span className="label-xs text-[var(--color-accent-ink)]">
            Visitanos &mdash; MMXXVI
          </span>
        </div>
        <div className="col-span-6 md:col-span-3 md:col-start-10 text-right">
          <span className="label-xs text-[var(--color-muted)]">
            37.4117 N // 5.9272 W
          </span>
        </div>
      </div>

      {/* Hero title */}
      <div className="px-6 md:px-10 pt-10 md:pt-14 pb-16 md:pb-24">
        <h1
          className="flex flex-wrap items-baseline gap-x-[0.25em] gap-y-2"
          style={{ fontSize: 'clamp(3rem, 8vw, 9rem)' }}
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
                  word === 'visitanos.'
                    ? 'italic font-light text-[var(--color-accent-ink)]'
                    : 'font-light text-[var(--color-ink)]'
                }`}
                style={{
                  fontSize: 'clamp(3rem, 8vw, 9rem)',
                  lineHeight: 0.82,
                  letterSpacing: '-0.035em',
                }}
              >
                {word}
              </span>
            </span>
          ))}
        </h1>
      </div>

      {/* Form + info grid — asymmetric split */}
      <div className="grid grid-cols-12 gap-6 md:gap-10 px-6 md:px-10 pb-24 md:pb-32">
        {/* Form — left, wider column */}
        <div
          ref={formRef}
          className="col-span-12 md:col-span-7 md:col-start-1"
        >
          <div className="mb-8 md:mb-10 flex items-baseline justify-between gap-4 border-b border-[var(--color-surface)] pb-4">
            <span className="label-xs text-[var(--color-accent-ink)]">
              [ 01 ] / Mantente al dia
            </span>
            <span className="label-xs text-[var(--color-muted)] hidden md:inline">
              Sin spam
            </span>
          </div>

          <p
            className="font-serif font-light text-[var(--color-muted)] max-w-lg mb-10 md:mb-14"
            style={{
              fontSize: 'clamp(1.05rem, 1.4vw, 1.3rem)',
              lineHeight: 1.5,
            }}
          >
            Dejanos tu email y te avisaremos cuando lleguen nuevas piezas a la
            tienda. Una vez al mes, en silencio.
          </p>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-10 max-w-xl"
            noValidate
          >
            {/* Nombre (optional) */}
            <label className="flex flex-col gap-2">
              <span className="label-xs text-[var(--color-muted)]">
                Nombre <span className="text-[var(--color-muted-soft)]">(opcional)</span>
              </span>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={50}
                placeholder="Como te llamas"
                className="bg-transparent border-b border-[var(--color-surface)] focus:border-[var(--color-accent)] outline-none py-3 font-serif font-light text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] transition-colors"
                style={{ fontSize: '1.25rem' }}
              />
            </label>

            {/* Email (required) */}
            <label className="flex flex-col gap-2">
              <span className="label-xs text-[var(--color-muted)]">
                Email <span className="text-[var(--color-accent-ink)]">*</span>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (status === 'error') {
                    setStatus('idle')
                    setMessage('')
                  }
                }}
                required
                placeholder="tu@email.com"
                className={`bg-transparent border-b outline-none py-3 font-serif font-light text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] transition-colors ${
                  status === 'error'
                    ? 'border-[var(--color-accent)]'
                    : 'border-[var(--color-surface)] focus:border-[var(--color-accent)]'
                }`}
                style={{ fontSize: '1.25rem' }}
              />
            </label>

            {/* Submit + status message */}
            <div className="flex items-center justify-between gap-6 flex-wrap">
              <button
                type="submit"
                disabled={status === 'loading'}
                className="group inline-flex items-baseline gap-3 border border-[var(--color-ink)] px-8 py-4 hover:bg-[var(--color-ink)] hover:text-[var(--color-base)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span
                  className="font-serif font-light"
                  style={{ fontSize: '1.15rem' }}
                >
                  {status === 'loading' ? 'Enviando…' : 'Suscribirme'}
                </span>
                <span
                  className="font-serif text-[var(--color-accent-ink)] group-hover:text-[var(--color-accent)]"
                  aria-hidden
                  style={{ fontSize: '1.15rem' }}
                >
                  &rarr;
                </span>
              </button>

              {message && (
                <span
                  role={status === 'error' ? 'alert' : 'status'}
                  className={`label-xs ${
                    status === 'success'
                      ? 'text-[var(--color-ink)]'
                      : 'text-[var(--color-accent-ink)]'
                  }`}
                >
                  {message}
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Info — right, narrower */}
        <aside
          ref={infoRef}
          className="col-span-12 md:col-span-4 md:col-start-9 flex flex-col gap-10 md:gap-12 md:pt-4"
        >
          <div className="flex items-baseline justify-between gap-4 border-b border-[var(--color-surface)] pb-4">
            <span className="label-xs text-[var(--color-accent-ink)]">
              [ 02 ] / La tienda
            </span>
          </div>

          {/* Address — links out to the real Google Business listing */}
          <div className="flex flex-col gap-2">
            <span className="label-xs text-[var(--color-muted)]">
              Direccion
            </span>
            <a
              href={SHOP.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="link"
              data-cursor-label="Ver en Maps"
              className="group inline-flex items-start gap-2.5 self-start"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[var(--color-accent-ink)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110"
                style={{ marginTop: '0.3rem', flexShrink: 0 }}
              >
                <path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21z" />
                <circle cx="12" cy="9.5" r="2.4" />
              </svg>
              <p
                className="font-serif font-light text-[var(--color-ink)] transition-colors duration-300 group-hover:text-[var(--color-accent-ink)]"
                style={{ fontSize: '1.35rem', lineHeight: 1.3 }}
              >
                {SHOP.address}
                <br />
                <span className="italic text-[var(--color-muted)]">
                  {SHOP.city}
                </span>
              </p>
            </a>
          </div>

          {/* Hours */}
          <div className="flex flex-col gap-3">
            <span className="label-xs text-[var(--color-muted)]">
              Horarios
            </span>
            <dl className="flex flex-col gap-1.5">
              {SHOP.hours.map(([day, time]) => (
                <div
                  key={day}
                  className="flex justify-between gap-4 border-b border-dashed border-[var(--color-surface)] pb-1.5"
                >
                  <dt
                    className="font-serif font-light text-[var(--color-ink)]"
                    style={{ fontSize: '1.05rem' }}
                  >
                    {day}
                  </dt>
                  <dd
                    className="font-serif font-light italic text-[var(--color-muted)]"
                    style={{ fontSize: '1.05rem' }}
                  >
                    {time}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Direct links */}
          <div className="flex flex-col gap-4">
            <span className="label-xs text-[var(--color-muted)]">Directo</span>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              {...whatsappHover}
              className="relative inline-flex items-baseline gap-3 self-start"
            >
              <span
                className="font-serif font-light text-[var(--color-ink)]"
                style={{ fontSize: '1.3rem' }}
              >
                WhatsApp
              </span>
              <span
                className="font-sans text-[var(--color-muted)]"
                style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}
              >
                658 509 332
              </span>
              <span
                ref={whatsappLineRef}
                className="absolute -bottom-1 left-0 right-0 h-px bg-[var(--color-ink)]"
                style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }}
              />
            </a>

            <a
              href={SHOP.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              {...instagramHover}
              className="relative inline-flex items-baseline gap-3 self-start"
            >
              <span
                className="font-serif font-light text-[var(--color-ink)]"
                style={{ fontSize: '1.3rem' }}
              >
                Instagram
              </span>
              <span
                className="font-sans text-[var(--color-muted)]"
                style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}
              >
                {SHOP.instagram}
              </span>
              <span
                ref={instagramLineRef}
                className="absolute -bottom-1 left-0 right-0 h-px bg-[var(--color-ink)]"
                style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }}
              />
            </a>

            <a
              href={SHOP.tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              {...tiktokHover}
              className="relative inline-flex items-baseline gap-3 self-start"
            >
              <span
                className="font-serif font-light text-[var(--color-ink)]"
                style={{ fontSize: '1.3rem' }}
              >
                TikTok
              </span>
              <span
                className="font-sans text-[var(--color-muted)]"
                style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}
              >
                {SHOP.tiktok}
              </span>
              <span
                ref={tiktokLineRef}
                className="absolute -bottom-1 left-0 right-0 h-px bg-[var(--color-ink)]"
                style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }}
              />
            </a>

            <a
              href={`mailto:${SHOP.email}`}
              {...emailHover}
              className="relative inline-flex items-baseline gap-3 self-start"
            >
              <span
                className="font-serif font-light text-[var(--color-ink)]"
                style={{ fontSize: '1.3rem' }}
              >
                Email
              </span>
              <span
                className="font-sans text-[var(--color-muted)]"
                style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}
              >
                {SHOP.email}
              </span>
              <span
                ref={emailLineRef}
                className="absolute -bottom-1 left-0 right-0 h-px bg-[var(--color-ink)]"
                style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }}
              />
            </a>
          </div>
        </aside>
      </div>

      {/* Map — full-width strip */}
      <div className="px-6 md:px-10 pb-24 md:pb-32">
        <div className="flex items-baseline justify-between gap-4 border-b border-[var(--color-surface)] pb-4 mb-8">
          <span className="label-xs text-[var(--color-accent-ink)]">
            [ 03 ] / Donde estamos
          </span>
          <span className="label-xs text-[var(--color-muted)] hidden md:inline">
            Calle Ciudad de Carlet, 10 — Parque Alcosa, Sevilla
          </span>
        </div>

        <div
          ref={mapRef}
          className="relative w-full overflow-hidden border border-[var(--color-surface)]"
          style={{
            height: 'clamp(320px, 52vh, 560px)',
            background: 'var(--color-surface)',
          }}
        >
          <iframe
            title="Mapa — Stylo019, Calle Ciudad de Carlet 10, Parque Alcosa, Sevilla"
            src={MAP_EMBED_URL}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 w-full h-full border-0"
            allowFullScreen
          />

          {/* Floating CTA — the embed itself isn't clickable-through to a
              real Maps page, this is what actually opens the listing */}
          <a
            href={SHOP.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir ubicacion en Google Maps"
            data-cursor="link"
            data-cursor-label="Abrir en Maps"
            className="group absolute top-4 right-4 z-10 inline-flex items-center gap-2 bg-[var(--color-paper)] border border-[var(--color-surface)] px-3.5 py-2.5 transition-colors hover:bg-[var(--color-ink)] hover:border-[var(--color-ink)]"
            style={{ boxShadow: '0 4px 20px -4px rgba(10, 10, 10, 0.25)' }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--color-accent-ink)] transition-colors group-hover:text-[var(--color-paper)]"
            >
              <path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.4" />
            </svg>
            <span
              className="label-xs text-[var(--color-ink)] transition-colors group-hover:text-[var(--color-paper)]"
              style={{ letterSpacing: '0.1em' }}
            >
              Abrir en Maps
            </span>
          </a>
        </div>
      </div>
    </section>
  )
}

export default Contacto
