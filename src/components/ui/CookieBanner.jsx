import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'cookie_consent'

export const CookieBanner = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Small delay so it doesn't flash on first paint
      const t = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(t)
    }
  }, [])

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-ink)] text-[var(--color-base)]"
      style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 md:px-10"
        style={{ padding: '1.25rem 2.5rem' }}
      >
        <p className="font-sans font-light text-[var(--color-surface)]" style={{ fontSize: '0.82rem', lineHeight: 1.6, maxWidth: '640px' }}>
          Usamos cookies técnicas necesarias para el funcionamiento de la web.
          Consulta nuestra{' '}
          <Link to="/cookies" className="text-[var(--color-base)] underline underline-offset-4 hover:text-[var(--color-accent)] transition-colors">
            política de cookies
          </Link>{' '}
          para más información.
        </p>
        <button
          type="button"
          onClick={accept}
          className="shrink-0 bg-[var(--color-base)] text-[var(--color-ink)] hover:bg-[var(--color-accent)] hover:text-[var(--color-base)] transition-colors"
          style={{
            padding: '0.6rem 1.5rem',
            fontSize: '0.72rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          Aceptar
        </button>
      </div>
    </div>
  )
}
