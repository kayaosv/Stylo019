import { useState, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useAuth } from '@/hooks/useAuth'

const Login = () => {
  const { session, signIn, loading: sessionLoading } = useAuth()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const cardRef = useRef(null)
  const titleRef = useRef(null)

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from(titleRef.current, { y: 20, opacity: 0, duration: 0.7 })
        .from(
          cardRef.current,
          { y: 24, opacity: 0, duration: 0.7 },
          '-=0.4',
        )
    },
    { scope: cardRef },
  )

  if (sessionLoading) return null
  if (session) {
    const from = location.state?.from?.pathname ?? '/admin'
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    const { error: err } = await signIn(email.trim(), password)
    setSubmitting(false)
    if (err) {
      setError('Credenciales incorrectas. Inténtalo de nuevo.')
      return
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-[var(--color-base)] px-6"
      style={{ paddingTop: '6rem', paddingBottom: '6rem' }}
    >
      {/* Decorative oversized type */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute font-serif text-[var(--color-surface)]"
        style={{
          fontSize: 'clamp(8rem, 22vw, 22rem)',
          fontWeight: 300,
          letterSpacing: '-0.04em',
          left: '-0.1em',
          top: '-0.15em',
          lineHeight: 0.85,
          opacity: 0.45,
          userSelect: 'none',
        }}
      >
        admin
      </span>

      <div
        ref={cardRef}
        className="relative z-10 w-full max-w-md bg-[var(--color-paper)]"
        style={{
          padding: '3rem 2.5rem',
          border: '1px solid var(--color-surface)',
        }}
      >
        <div ref={titleRef} className="mb-10">
          <span
            className="label-xs text-[var(--color-accent)]"
            style={{ letterSpacing: '0.3em' }}
          >
            Stylo019 · CMS
          </span>
          <h1
            className="font-serif text-[var(--color-ink)]"
            style={{
              fontSize: 'clamp(2.25rem, 4vw, 3rem)',
              fontWeight: 300,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              marginTop: '0.75rem',
            }}
          >
            Acceso privado
          </h1>
          <p
            className="font-sans text-[var(--color-muted)]"
            style={{
              fontSize: '0.85rem',
              marginTop: '0.75rem',
              lineHeight: 1.55,
            }}
          >
            Gestión de productos, stock y catálogo.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col"
          style={{ gap: '1.5rem' }}
        >
          <label className="flex flex-col" style={{ gap: '0.5rem' }}>
            <span
              className="label-xs text-[var(--color-muted)]"
              style={{ letterSpacing: '0.2em' }}
            >
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-transparent font-sans text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-accent)]"
              style={{
                borderBottom: '1px solid var(--color-surface)',
                padding: '0.6rem 0',
                fontSize: '0.95rem',
              }}
            />
          </label>

          <label className="flex flex-col" style={{ gap: '0.5rem' }}>
            <span
              className="label-xs text-[var(--color-muted)]"
              style={{ letterSpacing: '0.2em' }}
            >
              Contraseña
            </span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-transparent font-sans text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-accent)]"
              style={{
                borderBottom: '1px solid var(--color-surface)',
                padding: '0.6rem 0',
                fontSize: '0.95rem',
              }}
            />
          </label>

          {error && (
            <p
              className="font-sans text-red-600"
              style={{ fontSize: '0.8rem', letterSpacing: '0.02em' }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="bg-[var(--color-ink)] font-sans text-[var(--color-paper)] transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{
              padding: '1rem 1.25rem',
              fontSize: '0.78rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              marginTop: '1rem',
            }}
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
