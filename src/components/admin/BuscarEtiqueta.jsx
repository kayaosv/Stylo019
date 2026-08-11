import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { itemsDeProducto, claveDe, buscarProductosPorNombre } from '@/services/etiquetas'
import { ImpresionEtiquetas } from '@/components/admin/ImpresionEtiquetas'

const hasCamera = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

const btnStyle = {
  fontSize: '0.72rem',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  padding: '0.75rem 1.1rem',
}

/**
 * Buscador manual de /admin/etiquetas: escaneá (pistola o cámara) o buscá
 * por nombre para traer CUALQUIER producto y reimprimir su etiqueta,
 * independientemente de si aparece en la lista automática de pendientes.
 * Cubre huecos reales de esa lista: productos marcados `activo:false` con
 * stock físico real (la lista de pendientes los excluye a propósito), o
 * simplemente reimprimir algo que ya está registrado como impreso.
 */
export const BuscarEtiqueta = () => {
  const videoRef = useRef(null)
  const codeReaderRef = useRef(null)
  const controlsRef = useRef(null)

  const [codigo, setCodigo] = useState('')
  const [buscandoCodigo, setBuscandoCodigo] = useState(false)
  const [errorCodigo, setErrorCodigo] = useState(null)
  const [cameraMode, setCameraMode] = useState(false)
  const [cameraError, setCameraError] = useState(null)

  const [queryNombre, setQueryNombre] = useState('')
  const [resultadosNombre, setResultadosNombre] = useState([])
  const [buscandoNombre, setBuscandoNombre] = useState(false)

  const [productoEncontrado, setProductoEncontrado] = useState(null)
  const [seleccion, setSeleccion] = useState(new Set())
  const [imprimiendo, setImprimiendo] = useState(null)

  useEffect(() => () => detenerCamara(), [])

  useEffect(() => {
    const term = queryNombre.trim()
    if (term.length < 2) {
      setResultadosNombre([])
      return
    }
    let cancelled = false
    setBuscandoNombre(true)
    const t = setTimeout(async () => {
      const data = await buscarProductosPorNombre(term)
      if (!cancelled) {
        setResultadosNombre(data)
        setBuscandoNombre(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [queryNombre])

  const detenerCamara = () => {
    controlsRef.current?.stop()
    controlsRef.current = null
    const stream = videoRef.current?.srcObject
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
  }

  const iniciarCamara = async () => {
    setCameraError(null)
    if (!videoRef.current) return
    try {
      if (!codeReaderRef.current) {
        // Lazy-loaded, mismo motivo que VentaFisica.jsx: la pistola es el
        // flujo principal, la cámara es respaldo — no cargar ~130kb de
        // ZXing en cada visita a /admin/etiquetas.
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        codeReaderRef.current = new BrowserMultiFormatReader()
      }
      controlsRef.current = await codeReaderRef.current.decodeFromConstraints(
        { video: { facingMode: 'environment', width: { ideal: 1280 } } },
        videoRef.current,
        (result) => {
          if (!result) return
          navigator.vibrate?.(80)
          detenerCamara()
          setCameraMode(false)
          buscarPorCodigo(result.getText())
        },
      )
    } catch (err) {
      setCameraError(`No se pudo acceder a la cámara: ${err.message}`)
    }
  }

  const toggleCamara = () => {
    if (cameraMode) {
      detenerCamara()
      setCameraMode(false)
      setCameraError(null)
    } else {
      setCameraMode(true)
      setTimeout(iniciarCamara, 100)
    }
  }

  const abrirProducto = (producto, preseleccion) => {
    setProductoEncontrado(producto)
    setSeleccion(preseleccion ?? new Set(itemsDeProducto(producto).map(claveDe)))
    setCodigo('')
    setQueryNombre('')
    setResultadosNombre([])
    setErrorCodigo(null)
  }

  const buscarPorCodigo = async (raw) => {
    const clean = (raw ?? '').trim()
    if (!clean) return
    setErrorCodigo(null)
    setBuscandoCodigo(true)
    const { data, error } = await supabase.rpc('buscar_por_barcode', { p_barcode: clean })
    setBuscandoCodigo(false)
    if (error) {
      setErrorCodigo(error.message)
      return
    }
    const hit = Array.isArray(data) ? data[0] : data
    if (!hit?.producto_id) {
      setErrorCodigo(`Ningún producto tiene el código "${clean}".`)
      setCodigo('')
      return
    }
    const producto = {
      id: hit.producto_id,
      nombre: hit.producto_nombre,
      imagenes: hit.imagenes,
      colores: hit.colores,
      // El match vino del código base (sin colores) exactamente cuando el
      // producto no tiene colores propios -- ahí el código base es "clean".
      barcode: (hit.colores?.length ?? 0) === 0 ? clean : null,
    }
    // Preselecciona solo la variante escaneada -- tenés esa prenda puntual
    // en mano, no necesariamente todos los colores del producto.
    abrirProducto(producto, new Set([clean]))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      buscarPorCodigo(codigo)
    }
  }

  const elegirPorNombre = (row) => {
    abrirProducto({ id: row.id, nombre: row.nombre, imagenes: row.imagenes, colores: row.colores, barcode: row.barcode })
  }

  const cerrar = () => {
    setProductoEncontrado(null)
    setSeleccion(new Set())
    setImprimiendo(null)
  }

  const toggleItem = (item) => {
    const key = claveDe(item)
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="bg-[var(--color-paper)]" style={{ border: '1px solid var(--color-surface)', padding: '1.5rem' }}>
      {imprimiendo ? (
        <ImpresionEtiquetas items={imprimiendo} onClose={() => setImprimiendo(null)} onDone={cerrar} />
      ) : productoEncontrado ? (
        <div className="flex flex-col" style={{ gap: '1.25rem' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-[var(--color-ink)]" style={{ fontSize: '1.15rem', fontWeight: 400 }}>
              {productoEncontrado.nombre}
            </h3>
            <button
              type="button"
              onClick={cerrar}
              className="font-sans text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              style={{ fontSize: '0.72rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}
            >
              Cancelar
            </button>
          </div>

          <div className="flex flex-col" style={{ gap: '0.4rem' }}>
            {itemsDeProducto(productoEncontrado).map((item) => (
              <label
                key={claveDe(item)}
                className="flex items-center transition-colors hover:bg-[var(--color-base)]"
                style={{ gap: '0.65rem', padding: '0.5rem 0.75rem', border: '1px solid var(--color-surface)', cursor: 'pointer' }}
              >
                <input type="checkbox" checked={seleccion.has(claveDe(item))} onChange={() => toggleItem(item)} />
                <span
                  className="shrink-0 overflow-hidden"
                  style={{ width: '2.5rem', height: '2.5rem', background: 'var(--color-surface)' }}
                >
                  {item.imagen && <img src={item.imagen} alt="" loading="lazy" className="w-full h-full object-cover" />}
                </span>
                <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.82rem' }}>
                  {item.colorLabel ?? 'Base (sin color)'}
                </span>
                <span className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.72rem', marginLeft: 'auto', letterSpacing: '0.03em' }}>
                  {item.barcode ?? 'Sin código'}
                </span>
              </label>
            ))}
          </div>

          <button
            type="button"
            disabled={seleccion.size === 0}
            onClick={() => setImprimiendo(itemsDeProducto(productoEncontrado).filter((i) => seleccion.has(claveDe(i))))}
            className="bg-[var(--color-ink)] font-sans text-[var(--color-paper)] transition-opacity hover:opacity-85 disabled:opacity-50 self-start"
            style={{ ...btnStyle, padding: '0.85rem 1.5rem' }}
          >
            Imprimir seleccionadas ({seleccion.size})
          </button>
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: '1.25rem' }}>
          <div>
            <span className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.25em' }}>
              Buscar y reimprimir
            </span>
            <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.78rem', marginTop: '0.3rem' }}>
              Escaneá o buscá cualquier producto (incluidos los inactivos) para traer su etiqueta, esté o no en la lista de pendientes de abajo.
            </p>
          </div>

          <div className="flex items-center" style={{ gap: '0.6rem' }}>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escaneá o escribí el código de barras…"
              className="flex-1 bg-[var(--color-base)] font-sans text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
              style={{ border: '1px solid var(--color-surface)', padding: '0.75rem 0.9rem', fontSize: '0.85rem' }}
            />
            {hasCamera() && (
              <button
                type="button"
                onClick={toggleCamara}
                className="font-sans"
                style={{
                  ...btnStyle,
                  border: cameraMode ? '1px solid var(--color-accent)' : '1px solid var(--color-surface)',
                  backgroundColor: cameraMode ? 'var(--color-accent)' : 'transparent',
                  color: cameraMode ? 'var(--color-paper)' : 'var(--color-muted)',
                }}
              >
                {cameraMode ? 'Cerrar cámara' : 'Cámara'}
              </button>
            )}
          </div>

          {cameraMode && (
            <div>
              <video ref={videoRef} className="w-full" style={{ maxWidth: '24rem', border: '1px solid var(--color-surface)' }} muted playsInline />
              {cameraError && (
                <p className="font-sans" style={{ fontSize: '0.78rem', color: '#c0392b', marginTop: '0.5rem' }}>
                  {cameraError}
                </p>
              )}
            </div>
          )}

          {buscandoCodigo && (
            <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.78rem' }}>
              Buscando…
            </p>
          )}
          {errorCodigo && (
            <p className="font-sans" style={{ fontSize: '0.78rem', color: '#c0392b' }}>
              {errorCodigo}
            </p>
          )}

          <div>
            <input
              type="text"
              value={queryNombre}
              onChange={(e) => setQueryNombre(e.target.value)}
              placeholder="O buscar por nombre del producto…"
              className="w-full bg-[var(--color-base)] font-sans text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
              style={{ border: '1px solid var(--color-surface)', padding: '0.75rem 0.9rem', fontSize: '0.85rem' }}
            />
            {buscandoNombre && (
              <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.78rem', marginTop: '0.4rem' }}>
                Buscando…
              </p>
            )}
            {resultadosNombre.length > 0 && (
              <div className="flex flex-col" style={{ gap: '0.3rem', marginTop: '0.6rem' }}>
                {resultadosNombre.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => elegirPorNombre(row)}
                    className="flex items-center text-left transition-colors hover:bg-[var(--color-base)]"
                    style={{ gap: '0.65rem', padding: '0.5rem 0.75rem', border: '1px solid var(--color-surface)' }}
                  >
                    <span
                      className="shrink-0 overflow-hidden"
                      style={{ width: '2.2rem', height: '2.2rem', background: 'var(--color-surface)' }}
                    >
                      {row.imagenes?.[0] && (
                        <img src={row.imagenes[0]} alt="" loading="lazy" className="w-full h-full object-cover" />
                      )}
                    </span>
                    <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.82rem' }}>
                      {row.nombre}
                    </span>
                    {!row.activo && (
                      <span
                        className="font-sans"
                        style={{ fontSize: '0.65rem', marginLeft: 'auto', padding: '0.15rem 0.5rem', color: '#b7791f', background: '#fdf3dc' }}
                      >
                        Inactivo
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
