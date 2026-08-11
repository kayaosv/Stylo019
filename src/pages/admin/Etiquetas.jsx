import { useEffect, useState, useMemo } from 'react'
import { fetchEtiquetasPendientes, claveDe } from '@/services/etiquetas'
import { ImpresionEtiquetas } from '@/components/admin/ImpresionEtiquetas'

const Etiquetas = () => {
  const [pendientes, setPendientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [seleccion, setSeleccion] = useState(new Set())
  const [imprimiendo, setImprimiendo] = useState(null)

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

  const irAImprimir = () => {
    setImprimiendo(pendientes.filter((i) => seleccion.has(claveDe(i))))
  }

  if (loading) {
    return (
      <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.85rem' }}>
        Cargando…
      </p>
    )
  }

  if (imprimiendo) {
    return (
      <ImpresionEtiquetas
        items={imprimiendo}
        onClose={() => setImprimiendo(null)}
        onDone={() => {
          setImprimiendo(null)
          cargar()
        }}
      />
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
            disabled={seleccion.size === 0}
            onClick={irAImprimir}
            className="bg-[var(--color-ink)] font-sans text-[var(--color-paper)] transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{ fontSize: '0.78rem', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '0.9rem 1.5rem' }}
          >
            Imprimir seleccionadas ({seleccion.size})
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
                      <span
                        className="shrink-0 overflow-hidden"
                        style={{ width: '2.5rem', height: '2.5rem', background: 'var(--color-surface)' }}
                      >
                        {item.imagen && (
                          <img src={item.imagen} alt="" loading="lazy" className="w-full h-full object-cover" />
                        )}
                      </span>
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
