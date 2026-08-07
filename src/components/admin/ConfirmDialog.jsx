import { useEffect, useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

/**
 * Minimal confirm dialog for destructive admin actions.
 * Controlled — the parent owns the `open` state.
 */
export const ConfirmDialog = ({
  open,
  title = 'Confirmar acción',
  message = '¿Estás segura? Esta acción no se puede deshacer.',
  confirmLabel = 'Eliminar',
  loadingLabel = 'Eliminando…',
  cancelLabel = 'Cancelar',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const overlayRef = useRef(null)
  const cardRef = useRef(null)

  useGSAP(
    () => {
      if (!open) return
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.25, ease: 'power2.out' },
      )
      gsap.fromTo(
        cardRef.current,
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, ease: 'power3.out' },
      )
    },
    { dependencies: [open] },
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !loading) onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, loading, onCancel])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(10, 37, 64, 0.55)', padding: '1.5rem' }}
      onClick={() => !loading && onCancel?.()}
    >
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--color-paper)]"
        style={{
          padding: '2.25rem 2rem',
          border: '1px solid var(--color-surface)',
        }}
      >
        <span
          className="label-xs text-[var(--color-accent)] block"
          style={{ letterSpacing: '0.28em' }}
        >
          Atención
        </span>
        <h3
          className="font-serif text-[var(--color-ink)]"
          style={{
            fontSize: '1.75rem',
            fontWeight: 300,
            letterSpacing: '-0.01em',
            marginTop: '0.5rem',
            lineHeight: 1.1,
          }}
        >
          {title}
        </h3>
        <p
          className="font-sans text-[var(--color-muted)]"
          style={{
            fontSize: '0.9rem',
            lineHeight: 1.55,
            marginTop: '0.85rem',
          }}
        >
          {message}
        </p>

        <div
          className="flex items-center justify-end"
          style={{ gap: '0.75rem', marginTop: '2rem' }}
        >
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="font-sans text-[var(--color-muted)] hover:text-[var(--color-ink)] disabled:opacity-50"
            style={{
              fontSize: '0.72rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              padding: '0.85rem 1rem',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="bg-[var(--color-ink)] text-[var(--color-paper)] transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{
              fontSize: '0.72rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              padding: '0.85rem 1.5rem',
            }}
          >
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
