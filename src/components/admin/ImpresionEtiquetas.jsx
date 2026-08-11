import { useEffect, useState } from 'react'
import { generarYGuardarBarcode, marcarEtiquetasImpresas } from '@/services/etiquetas'
import { BarcodeImage } from '@/components/admin/BarcodeImage'

/**
 * Self-contained print + confirm flow for a batch of etiquetas, reused by
 * both /admin/etiquetas (lote completo) and el botón puntual en
 * ProductosList (un producto suelto). Owns its own lifecycle: genera
 * códigos que falten, muestra la vista de impresión, y exige confirmar
 * cuáles salieron bien antes de registrarlas en etiquetas_impresas.
 *
 * @param {Array} items - items a imprimir (barcode puede venir null)
 * @param {() => void} onClose - cancelar antes de imprimir (sin marcar nada)
 * @param {() => void} onDone - tras confirmar (parcial o total)
 */
export const ImpresionEtiquetas = ({ items, onClose, onDone }) => {
  const [resolviendo, setResolviendo] = useState(true)
  const [itemsResueltos, setItemsResueltos] = useState(null)
  const [error, setError] = useState(null)
  const [confirmando, setConfirmando] = useState(false)
  const [salieronBien, setSalieronBien] = useState(new Set())
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let cancelled = false
    const resolver = async () => {
      try {
        const resueltos = []
        for (const item of items) {
          resueltos.push(item.barcode ? item : await generarYGuardarBarcode(item))
        }
        if (!cancelled) {
          setItemsResueltos(resueltos)
          setResolviendo(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(`No se pudo generar un código: ${err.message}`)
          setResolviendo(false)
        }
      }
    }
    resolver()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleSalioBien = (barcode) => {
    setSalieronBien((prev) => {
      const next = new Set(prev)
      if (next.has(barcode)) next.delete(barcode)
      else next.add(barcode)
      return next
    })
  }

  // Solo lo que el usuario confirma que salió se registra — lo que quede
  // desmarcado (o el lote entero, si se cancela el diálogo de impresión)
  // nunca entra a etiquetas_impresas, así que sigue apareciendo pendiente
  // sin necesidad de buscarlo producto por producto.
  const confirmarSeleccionadas = async () => {
    setGuardando(true)
    const confirmadas = itemsResueltos.filter((i) => salieronBien.has(i.barcode))
    await marcarEtiquetasImpresas(confirmadas)
    setGuardando(false)
    onDone()
  }

  if (resolviendo) {
    return (
      <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.85rem' }}>
        Generando códigos…
      </p>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col" style={{ gap: '1rem' }}>
        <p className="font-sans" style={{ fontSize: '0.82rem', color: '#c0392b' }}>
          {error}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="font-sans text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          style={{ fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase', padding: '0.75rem 1rem', border: '1px solid var(--color-surface)', alignSelf: 'flex-start' }}
        >
          Volver
        </button>
      </div>
    )
  }

  if (confirmando) {
    return (
      <div className="flex flex-col" style={{ gap: '1.5rem', maxWidth: '32rem' }}>
        <div>
          <h1
            className="font-serif text-[var(--color-ink)]"
            style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 300, letterSpacing: '-0.02em' }}
          >
            ¿Salieron bien?
          </h1>
          <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>
            Marca solo las que viste salir bien de la impresora — lo que dejes sin marcar se queda en pendientes para reintentar más tarde.
          </p>
        </div>

        <div className="bg-[var(--color-paper)]" style={{ border: '1px solid var(--color-surface)', padding: '1.25rem' }}>
          <div className="flex flex-col" style={{ gap: '0.4rem' }}>
            {itemsResueltos.map((item) => (
              <label
                key={item.barcode}
                className="flex items-center transition-colors hover:bg-[var(--color-base)]"
                style={{ gap: '0.65rem', padding: '0.5rem 0.75rem', border: '1px solid var(--color-surface)', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={salieronBien.has(item.barcode)}
                  onChange={() => toggleSalioBien(item.barcode)}
                />
                <span
                  className="shrink-0 overflow-hidden"
                  style={{ width: '2.5rem', height: '2.5rem', background: 'var(--color-surface)' }}
                >
                  {item.imagen && (
                    <img src={item.imagen} alt="" loading="lazy" className="w-full h-full object-cover" />
                  )}
                </span>
                <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.82rem' }}>
                  {item.productoNombre}
                  {item.colorLabel ? ` · ${item.colorLabel}` : ''}
                </span>
                <span
                  className="font-sans text-[var(--color-muted)]"
                  style={{ fontSize: '0.72rem', marginLeft: 'auto', letterSpacing: '0.03em' }}
                >
                  {item.barcode}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center" style={{ gap: '0.75rem' }}>
          <button
            type="button"
            disabled={guardando}
            onClick={confirmarSeleccionadas}
            className="bg-[var(--color-ink)] font-sans text-[var(--color-paper)] transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{ fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase', padding: '0.95rem 1.75rem' }}
          >
            {guardando ? 'Guardando…' : `Confirmar ${salieronBien.size} de ${itemsResueltos.length}`}
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="font-sans text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            style={{ fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase', padding: '0.95rem 1.25rem', border: '1px solid var(--color-surface)' }}
          >
            Volver a la vista de impresión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center" style={{ gap: '1.5rem' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #etiquetas-print, #etiquetas-print * { visibility: visible; }
          #etiquetas-print { position: absolute; top: 0; left: 0; width: 80mm; }
          .etiquetas-no-print { display: none !important; }
        }
      `}</style>

      <div className="etiquetas-no-print flex items-center" style={{ gap: '0.75rem' }}>
        <button
          type="button"
          onClick={() => {
            window.print()
            setConfirmando(true)
          }}
          className="bg-[var(--color-ink)] font-sans text-[var(--color-paper)] transition-opacity hover:opacity-85 disabled:opacity-50"
          style={{ fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase', padding: '0.95rem 1.75rem' }}
        >
          Imprimir {itemsResueltos.length} etiqueta{itemsResueltos.length === 1 ? '' : 's'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="font-sans text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          style={{ fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase', padding: '0.95rem 1.25rem', border: '1px solid var(--color-surface)' }}
        >
          Volver
        </button>
      </div>

      <div
        id="etiquetas-print"
        className="bg-[var(--color-paper)] font-sans text-[var(--color-ink)]"
        style={{ width: '320px' }}
      >
        {itemsResueltos.map((item) => (
          <div
            key={item.barcode}
            className="flex flex-col items-center"
            style={{ padding: '0.7rem 0', borderBottom: '1px dashed var(--color-surface)' }}
          >
            <p className="font-serif" style={{ fontSize: '0.85rem', textAlign: 'center', marginBottom: '0.15rem' }}>
              {item.productoNombre}
            </p>
            {item.colorLabel && (
              <p style={{ fontSize: '0.68rem', color: 'var(--color-muted)', marginBottom: '0.25rem' }}>
                {item.colorLabel}
              </p>
            )}
            <BarcodeImage value={item.barcode} height={38} width={1.5} fontSize={10} />
          </div>
        ))}
      </div>
    </div>
  )
}
