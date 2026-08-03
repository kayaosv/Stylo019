import { useEffect, useState, useMemo } from 'react'
import { fetchEtiquetasPendientes, marcarEtiquetasImpresas, generarYGuardarBarcode, claveDe } from '@/services/etiquetas'
import { BarcodeImage } from '@/components/admin/BarcodeImage'

const Etiquetas = () => {
  const [pendientes, setPendientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [seleccion, setSeleccion] = useState(new Set())
  const [itemsImprimir, setItemsImprimir] = useState(null)
  const [resolviendo, setResolviendo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const cargar = async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await fetchEtiquetasPendientes()
    if (err) setError('Error cargando etiquetas pendientes. Revisa tu conexión.')
    setPendientes(data)
    setSeleccion(new Set(data.map(claveDe)))
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  const porProducto = useMemo(() => {
    const map = new Map()
    for (const item of pendientes) {
      if (!map.has(item.productoId)) {
        map.set(item.productoId, { nombre: item.productoNombre, items: [] })
      }
      map.get(item.productoId).items.push(item)
    }
    return [...map.values()]
  }, [pendientes])

  const sinCodigoCount = pendientes.filter((i) => i.estado === 'sin_codigo').length
  const sinImprimirCount = pendientes.filter((i) => i.estado === 'sin_imprimir').length

  const toggle = (item) => {
    const key = claveDe(item)
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleTodos = () => {
    setSeleccion((prev) =>
      prev.size === pendientes.length ? new Set() : new Set(pendientes.map(claveDe))
    )
  }

  // Any item still missing a code gets a real one generated + saved here,
  // right before the print batch — that way the label that comes out
  // always shows a real, already-persisted code, never a preview.
  const irAImprimir = async () => {
    const seleccionados = pendientes.filter((i) => seleccion.has(claveDe(i)))
    setResolviendo(true)
    setError(null)
    try {
      const resueltos = []
      for (const item of seleccionados) {
        if (item.estado === 'sin_codigo') {
          resueltos.push(await generarYGuardarBarcode(item))
        } else {
          resueltos.push(item)
        }
      }
      setItemsImprimir(resueltos)
    } catch (err) {
      setError(`No se pudo generar un código: ${err.message}`)
    } finally {
      setResolviendo(false)
    }
  }

  // Optimistic — same posture as the rest of the admin (see odoo-sync,
  // crear_venta_tpv): clicking "Imprimir" is treated as the real action,
  // there's no reliable cross-browser way to detect whether the OS print
  // dialog was actually completed vs. cancelled. Worst case if cancelled:
  // the item silently drops off "pendientes" and has to be reprinted by
  // hand later — low-stakes, not a stock or money operation.
  const confirmarImpresion = async () => {
    setGuardando(true)
    await marcarEtiquetasImpresas(itemsImprimir)
    setGuardando(false)
    setItemsImprimir(null)
    cargar()
  }

  if (loading) {
    return (
      <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.85rem' }}>
        Cargando…
      </p>
    )
  }

  if (itemsImprimir) {
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
            disabled={guardando}
            onClick={async () => {
              window.print()
              await confirmarImpresion()
            }}
            className="bg-[var(--color-ink)] font-sans text-[var(--color-paper)] transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{ fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase', padding: '0.95rem 1.75rem' }}
          >
            Imprimir {itemsImprimir.length} etiqueta{itemsImprimir.length === 1 ? '' : 's'}
          </button>
          <button
            type="button"
            onClick={() => setItemsImprimir(null)}
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
          {itemsImprimir.map((item) => (
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

  return (
    <div className="flex flex-col" style={{ gap: '1.5rem' }}>
      <div className="flex flex-wrap items-end justify-between" style={{ gap: '1rem' }}>
        <div>
          <h1
            className="font-serif text-[var(--color-ink)]"
            style={{ fontSize: 'clamp(2.25rem, 4.5vw, 3.5rem)', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1 }}
          >
            Etiquetas
          </h1>
          <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
            {pendientes.length === 0
              ? 'Todo lo que tiene stock ya tiene código y etiqueta impresa.'
              : `${sinCodigoCount} sin código todavía · ${sinImprimirCount} con código sin imprimir`}
          </p>
        </div>
        {pendientes.length > 0 && (
          <button
            type="button"
            disabled={seleccion.size === 0 || resolviendo}
            onClick={irAImprimir}
            className="bg-[var(--color-ink)] font-sans text-[var(--color-paper)] transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{ fontSize: '0.78rem', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '0.9rem 1.5rem' }}
          >
            {resolviendo ? 'Generando códigos…' : `Imprimir seleccionadas (${seleccion.size})`}
          </button>
        )}
      </div>

      {error && (
        <p className="font-sans" style={{ fontSize: '0.78rem', color: '#c0392b' }}>
          {error}
        </p>
      )}

      {pendientes.length > 0 && (
        <div className="bg-[var(--color-paper)]" style={{ border: '1px solid var(--color-surface)', padding: '1.5rem' }}>
          <button
            type="button"
            onClick={toggleTodos}
            className="font-sans text-[var(--color-accent-ink)]"
            style={{ fontSize: '0.75rem', marginBottom: '1.25rem' }}
          >
            {seleccion.size === pendientes.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>

          <div className="flex flex-col" style={{ gap: '1.5rem' }}>
            {porProducto.map((grupo) => (
              <div key={grupo.nombre}>
                <p className="font-serif text-[var(--color-ink)]" style={{ fontSize: '1rem', marginBottom: '0.6rem' }}>
                  {grupo.nombre}
                </p>
                <div className="flex flex-col" style={{ gap: '0.4rem' }}>
                  {grupo.items.map((item) => (
                    <label
                      key={claveDe(item)}
                      className="flex items-center transition-colors hover:bg-[var(--color-base)]"
                      style={{ gap: '0.65rem', padding: '0.5rem 0.75rem', border: '1px solid var(--color-surface)', cursor: 'pointer' }}
                    >
                      <input type="checkbox" checked={seleccion.has(claveDe(item))} onChange={() => toggle(item)} />
                      <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.82rem' }}>
                        {item.colorLabel ?? 'Base (sin color)'}
                      </span>
                      {item.estado === 'sin_codigo' ? (
                        <span
                          className="font-sans"
                          style={{
                            fontSize: '0.68rem',
                            marginLeft: 'auto',
                            padding: '0.15rem 0.5rem',
                            color: '#b7791f',
                            background: '#fdf3dc',
                          }}
                        >
                          Sin código
                        </span>
                      ) : (
                        <span
                          className="font-sans text-[var(--color-muted)]"
                          style={{ fontSize: '0.72rem', marginLeft: 'auto', letterSpacing: '0.03em' }}
                        >
                          {item.barcode}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Etiquetas
