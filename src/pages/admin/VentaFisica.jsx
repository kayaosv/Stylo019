import { useRef, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { normalizeColores } from '@/lib/colores'
import { getPrecioEfectivo } from '@/lib/precio'
import { TicketVenta } from '@/components/admin/TicketVenta'

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code']

const hasCamera = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
const hasBarcodeDetector = () =>
  typeof window !== 'undefined' && 'BarcodeDetector' in window

// Only sizes with stock > 0 are selectable — mirrors estaAgotado()'s logic
// of inspecting values, not keys, so it works for any tipo_talla set.
const tallasConStock = (tallas = {}) =>
  Object.entries(tallas ?? {}).filter(([, stock]) => Number(stock) > 0)

// Foto a mostrar en cada paso de la venta — la del color elegido si la
// tiene, si no la base del producto. Sin esto, quien vende no tenía
// forma de confirmar visualmente el artículo (ni en la búsqueda, ni al
// elegir color/talla, ni en el carrito).
const resolveImagen = (producto, colorId, colores = []) => {
  if (colorId) {
    const color = colores.find((c) => c.id === colorId)
    if (color?.imagenes?.[0]) return color.imagenes[0]
  }
  return producto?.imagenes?.[0] ?? null
}

const Thumb = ({ src, size = '2.4rem' }) =>
  src ? (
    <img
      src={src}
      alt=""
      style={{ width: size, height: size, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--color-surface)' }}
    />
  ) : (
    <div style={{ width: size, height: size, background: 'var(--color-base)', flexShrink: 0, border: '1px solid var(--color-surface)' }} />
  )

const VentaFisica = () => {
  const scanRef = useRef(null)
  const inputRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const detectorRef = useRef(null)

  const [codigo, setCodigo] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [cart, setCart] = useState([])
  const [notFound, setNotFound] = useState(false)
  const [cameraMode, setCameraMode] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [metodoPago, setMetodoPago] = useState(null)
  const [cobrando, setCobrando] = useState(false)
  const [ultimaVenta, setUltimaVenta] = useState(null)
  const [error, setError] = useState(null)

  // Two-step picker shown after a product is matched (barcode or search):
  // pick a color (only when the product has variants) then a size.
  const [colorStep, setColorStep] = useState(null) // { producto, colores }
  const [sizeStep, setSizeStep] = useState(null) // { producto, colorId, colorLabel, tallas }

  useEffect(() => {
    if (!cameraMode && !ultimaVenta) inputRef.current?.focus()
  }, [cameraMode, ultimaVenta])

  useEffect(() => {
    if (cameraMode || ultimaVenta) return
    const capture = () => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', capture, true)
    return () => window.removeEventListener('keydown', capture, true)
  }, [cameraMode, ultimaVenta])

  useEffect(() => () => detenerCamara(), [])

  const detenerCamara = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const iniciarCamara = async () => {
    setCameraError(null)
    if (!hasBarcodeDetector()) {
      setCameraError('Tu navegador no soporta detección de códigos. Usa Chrome en Android o Safari iOS 16.4+')
      return
    }
    try {
      detectorRef.current = new window.BarcodeDetector({ formats: BARCODE_FORMATS })
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      loopCamara()
    } catch (err) {
      setCameraError(`No se pudo acceder a la cámara: ${err.message}`)
    }
  }

  const loopCamara = async () => {
    if (!videoRef.current || !detectorRef.current) return
    try {
      const codes = await detectorRef.current.detect(videoRef.current)
      if (codes.length > 0) {
        navigator.vibrate?.(80)
        detenerCamara()
        setCameraMode(false)
        await buscarPorCodigo(codes[0].rawValue)
        return
      }
    } catch (_) {}
    rafRef.current = requestAnimationFrame(loopCamara)
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

  const buscarPorCodigo = useCallback(async (raw) => {
    const clean = (raw ?? '').trim()
    if (!clean) return
    setNotFound(false)
    setError(null)

    const { data, error: err } = await supabase.rpc('buscar_por_barcode', { p_barcode: clean })
    if (err) {
      setError(err.message)
      return
    }
    const hit = Array.isArray(data) ? data[0] : data

    if (!hit?.producto_id) {
      setNotFound(true)
      setCodigo('')
      return
    }
    if (!hit.activo) {
      setError(`"${hit.producto_nombre}" ya no está disponible.`)
      setCodigo('')
      return
    }

    const producto = {
      id: hit.producto_id,
      nombre: hit.producto_nombre,
      precio: hit.precio,
      precio_oferta: hit.precio_oferta,
      precios_talla: hit.precios_talla,
      imagenes: hit.imagenes,
    }
    const colores = normalizeColores(hit.colores)

    // A color-specific barcode with its own stock map goes straight to size
    // picking; a base-product barcode (or a color barcode whose color has
    // no per-color stock split yet) falls back to the product's own tallas.
    const tallas = hit.color_tallas ?? hit.tallas ?? {}
    const imagen = resolveImagen(producto, hit.color_id, colores)
    setSizeStep({ producto, colorId: hit.color_id, colorLabel: hit.color_label, tallas, imagen })
    setCodigo('')
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      buscarPorCodigo(codigo)
    }
  }

  // Name search — basic fallback, always available alongside the scanner.
  useEffect(() => {
    const term = busqueda.trim()
    if (term.length < 2) {
      setResultados([])
      return
    }
    let cancelled = false
    setBuscando(true)
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('productos')
        .select('id, nombre, precio, precio_oferta, precios_talla, tallas, colores, activo, imagenes')
        .eq('activo', true)
        .ilike('nombre', `%${term}%`)
        .limit(8)
      if (!cancelled) {
        setResultados(data ?? [])
        setBuscando(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [busqueda])

  const elegirProducto = (row) => {
    setError(null)
    const producto = {
      id: row.id,
      nombre: row.nombre,
      precio: row.precio,
      precio_oferta: row.precio_oferta,
      precios_talla: row.precios_talla,
      imagenes: row.imagenes,
    }
    const colores = normalizeColores(row.colores)
    setBusqueda('')
    setResultados([])
    if (colores.length > 0) {
      setColorStep({ producto, colores, tallasBase: row.tallas ?? {} })
    } else {
      setSizeStep({ producto, colorId: null, colorLabel: null, tallas: row.tallas ?? {}, imagen: resolveImagen(producto, null) })
    }
  }

  const elegirColor = (color) => {
    setSizeStep({
      producto: colorStep.producto,
      colorId: color.id,
      colorLabel: color.label,
      tallas: color.tallas ?? colorStep.tallasBase,
      imagen: resolveImagen(colorStep.producto, color.id, colorStep.colores),
    })
    setColorStep(null)
  }

  // stockDisponible is a snapshot of that exact color+talla combination taken
  // when the line is added/incremented here — same convention as the web
  // cart's useCartStore.addItem, so both surfaces cap at the real per-variant
  // stock instead of the product's aggregate. crear_venta_tpv re-validates
  // against live stock at "Cobrar" regardless, so this is a UX guard (catch
  // it while building the sale, not after quoting the customer a total),
  // not the only safety net.
  const elegirTalla = (talla) => {
    const { producto, colorId, colorLabel, imagen, tallas } = sizeStep
    const precioUnitario = getPrecioEfectivo(producto, talla)
    const key = `${producto.id}:${colorId ?? 'base'}:${talla}`
    const stockDisponible = Number(tallas?.[talla]) || 0

    setCart((prev) => {
      const existing = prev.find((l) => l.key === key)
      if (existing) {
        return prev.map((l) =>
          l.key === key
            ? { ...l, stockDisponible, cantidad: Math.max(1, Math.min(l.cantidad + 1, stockDisponible)) }
            : l
        )
      }
      return [...prev, {
        key, productoId: producto.id, productoNombre: producto.nombre,
        colorId, colorLabel, talla, cantidad: 1, precioUnitario, imagen, stockDisponible,
      }]
    })
    setSizeStep(null)
  }

  const cambiarCantidad = (key, delta) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.key !== key) return l
          const max = l.stockDisponible ?? Infinity
          return { ...l, cantidad: Math.max(0, Math.min(l.cantidad + delta, max)) }
        })
        .filter((l) => l.cantidad > 0)
    )
  }

  const quitarLinea = (key) => setCart((prev) => prev.filter((l) => l.key !== key))

  const total = cart.reduce((sum, l) => sum + l.precioUnitario * l.cantidad, 0)

  const cobrar = async () => {
    if (cart.length === 0 || !metodoPago || cobrando) return
    setCobrando(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('crear_venta_tpv', {
        p_items: cart.map((l) => ({
          producto_id: l.productoId,
          color_id: l.colorId,
          talla: l.talla,
          cantidad: l.cantidad,
        })),
        p_metodo_pago: metodoPago,
      })
      if (err) throw err

      const venta = Array.isArray(data) ? data[0] : data
      setUltimaVenta({
        ventaId: venta.venta_id,
        numeroTicket: venta.numero_ticket,
        total: venta.total,
        metodoPago,
        items: cart,
        createdAt: new Date(),
      })
      setCart([])
      setMetodoPago(null)

      // Fire-and-forget: the sale is already confirmed and stock already
      // decremented — this only attempts the Odoo invoice in parallel
      // without blocking the screen (see supabase/functions/odoo-sync).
      supabase.functions.invoke('odoo-sync', { body: { venta_id: venta.venta_id } }).catch(() => {})
    } catch (err) {
      setError(`No se pudo cobrar la venta: ${err.message}`)
    } finally {
      setCobrando(false)
    }
  }

  const nuevaVenta = () => {
    setUltimaVenta(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  if (ultimaVenta) {
    return <TicketVenta venta={ultimaVenta} onNuevaVenta={nuevaVenta} />
  }

  return (
    <div ref={scanRef} className="flex flex-col" style={{ gap: '2rem' }}>
      <div className="flex flex-wrap items-end justify-between" style={{ gap: '1rem' }}>
        <div>
          <h1
            className="font-serif text-[var(--color-ink)]"
            style={{ fontSize: 'clamp(2.25rem, 4.5vw, 3.5rem)', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1 }}
          >
            Venta física
          </h1>
          <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Pistola de código de barras · Enter para agregar{hasCamera() ? ' · o usa la cámara' : ''}
          </p>
        </div>
        {hasCamera() && (
          <button
            type="button"
            onClick={toggleCamara}
            className="font-sans transition-colors"
            style={{
              fontSize: '0.72rem', letterSpacing: '0.2em', textTransform: 'uppercase',
              padding: '0.75rem 1.25rem',
              border: cameraMode ? '1px solid var(--color-accent)' : '1px solid var(--color-surface)',
              backgroundColor: cameraMode ? 'var(--color-accent)' : 'transparent',
              color: cameraMode ? 'var(--color-paper)' : 'var(--color-muted)',
            }}
          >
            {cameraMode ? 'Cerrar cámara' : '📷 Cámara'}
          </button>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', gap: '2rem' }}>
        {/* Left: scan + search */}
        <div className="flex flex-col" style={{ gap: '1.5rem' }}>
          <div className="bg-[var(--color-paper)]" style={{ border: '1px solid var(--color-surface)', padding: '1.5rem' }}>
            {cameraMode ? (
              <div>
                <video ref={videoRef} className="w-full" playsInline muted style={{ border: '1px solid var(--color-surface)' }} />
                {cameraError && <p className="font-sans" style={{ fontSize: '0.78rem', color: '#c0392b', marginTop: '0.75rem' }}>{cameraError}</p>}
              </div>
            ) : (
              <input
                ref={inputRef}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escaneá o escribí el código de barras…"
                autoFocus
                className="w-full bg-[var(--color-base)] font-serif text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                style={{ border: '1px solid var(--color-surface)', padding: '1.1rem 1.25rem', fontSize: '1.15rem' }}
              />
            )}

            {notFound && (
              <p className="font-sans" style={{ fontSize: '0.78rem', color: '#c0392b', marginTop: '0.75rem' }}>
                Código no encontrado — ningún producto o color tiene ese código de barras.
              </p>
            )}
          </div>

          <div className="bg-[var(--color-paper)]" style={{ border: '1px solid var(--color-surface)', padding: '1.5rem' }}>
            <p className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.22em', marginBottom: '0.75rem' }}>
              O buscar por nombre
            </p>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Vestido Lino Sevilla…"
              className="w-full bg-[var(--color-base)] font-sans text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
              style={{ border: '1px solid var(--color-surface)', padding: '0.85rem 1rem', fontSize: '0.9rem' }}
            />
            {buscando && <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>Buscando…</p>}
            {resultados.length > 0 && (
              <div className="flex flex-col" style={{ gap: '0.4rem', marginTop: '0.85rem' }}>
                {resultados.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => elegirProducto(r)}
                    className="flex items-center text-left font-sans transition-colors hover:bg-[var(--color-base)]"
                    style={{ gap: '0.65rem', padding: '0.5rem 0.85rem', border: '1px solid var(--color-surface)', fontSize: '0.85rem' }}
                  >
                    <Thumb src={resolveImagen(r, null)} size="2rem" />
                    {r.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: cart */}
        <div className="bg-[var(--color-paper)] flex flex-col" style={{ border: '1px solid var(--color-surface)', padding: '1.5rem', gap: '1.25rem' }}>
          {cart.length === 0 ? (
            <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.85rem' }}>
              El carrito está vacío — escaneá o buscá un producto para empezar.
            </p>
          ) : (
            <div className="flex flex-col" style={{ gap: '0.75rem' }}>
              {cart.map((l) => {
                const atMax = l.stockDisponible != null && l.cantidad >= l.stockDisponible
                return (
                  <div key={l.key} className="flex items-center justify-between" style={{ gap: '0.75rem', borderBottom: '1px solid var(--color-surface)', paddingBottom: '0.75rem' }}>
                    <div className="flex items-center" style={{ gap: '0.65rem', minWidth: 0 }}>
                      <Thumb src={l.imagen} size="2.5rem" />
                      <div style={{ minWidth: 0 }}>
                        <p className="font-serif text-[var(--color-ink)]" style={{ fontSize: '0.95rem' }}>{l.productoNombre}</p>
                        <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.75rem' }}>
                          {[l.colorLabel, `Talla ${l.talla}`].filter(Boolean).join(' — ')} · {l.precioUnitario.toFixed(2)} € / u
                          {atMax && <span style={{ color: 'var(--color-accent-ink)' }}> · Última unidad</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center" style={{ gap: '0.5rem', flexShrink: 0 }}>
                      <button type="button" onClick={() => cambiarCantidad(l.key, -1)} style={{ padding: '0.25rem 0.6rem', border: '1px solid var(--color-surface)' }}>−</button>
                      <span className="font-serif" style={{ minWidth: '1.5rem', textAlign: 'center' }}>{l.cantidad}</span>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(l.key, 1)}
                        disabled={atMax}
                        aria-label={atMax ? 'Sin más stock disponible' : 'Aumentar cantidad'}
                        style={{
                          padding: '0.25rem 0.6rem',
                          border: '1px solid var(--color-surface)',
                          opacity: atMax ? 0.4 : 1,
                          cursor: atMax ? 'not-allowed' : 'pointer',
                        }}
                      >
                        +
                      </button>
                    </div>
                    <span className="font-serif" style={{ width: '4.5rem', textAlign: 'right', flexShrink: 0 }}>
                      {(l.precioUnitario * l.cantidad).toFixed(2)} €
                    </span>
                    <button type="button" onClick={() => quitarLinea(l.key)} aria-label="Quitar" style={{ flexShrink: 0, color: 'var(--color-muted)' }}>✕</button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-center justify-between font-serif" style={{ fontSize: '1.5rem', paddingTop: '0.5rem' }}>
            <span>Total</span>
            <span>{total.toFixed(2)} €</span>
          </div>

          <div className="flex" style={{ gap: '0.75rem' }}>
            {['efectivo', 'tarjeta'].map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setMetodoPago(tipo)}
                className="flex-1 font-sans transition-colors"
                style={{
                  fontSize: '0.78rem', letterSpacing: '0.15em', textTransform: 'uppercase',
                  padding: '0.85rem', border: metodoPago === tipo ? '1px solid var(--color-accent)' : '1px solid var(--color-surface)',
                  backgroundColor: metodoPago === tipo ? 'var(--color-accent)' : 'transparent',
                  color: metodoPago === tipo ? 'var(--color-paper)' : 'var(--color-muted)',
                }}
              >
                {tipo === 'efectivo' ? '💶 Efectivo' : '💳 Tarjeta'}
              </button>
            ))}
          </div>

          {error && <p className="font-sans" style={{ fontSize: '0.78rem', color: '#c0392b' }}>{error}</p>}

          <button
            type="button"
            disabled={cart.length === 0 || !metodoPago || cobrando}
            onClick={cobrar}
            className="bg-[var(--color-ink)] font-sans text-[var(--color-paper)] transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{ fontSize: '0.85rem', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '1.1rem' }}
          >
            {cobrando ? 'Cobrando…' : `Cobrar ${total.toFixed(2)} €`}
          </button>
        </div>
      </div>

      {colorStep && (
        <Modal onClose={() => setColorStep(null)} title={`${colorStep.producto.nombre} — elegir color`}>
          <div className="flex flex-wrap" style={{ gap: '0.6rem' }}>
            {colorStep.colores.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => elegirColor(c)}
                className="flex items-center font-sans"
                style={{ gap: '0.5rem', padding: '0.5rem 0.85rem 0.5rem 0.5rem', border: '1px solid var(--color-surface)' }}
              >
                {c.imagenes?.[0] ? (
                  <Thumb src={c.imagenes[0]} size="2.4rem" />
                ) : (
                  <span style={{ width: '0.9rem', height: '0.9rem', borderRadius: '9999px', background: c.hex, border: c.border ? '1px solid rgba(0,0,0,0.2)' : 'none', display: 'inline-block' }} />
                )}
                {c.label}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {sizeStep && (
        <Modal onClose={() => setSizeStep(null)} title={[sizeStep.producto.nombre, sizeStep.colorLabel].filter(Boolean).join(' — ')}>
          {sizeStep.imagen && (
            <img
              src={sizeStep.imagen}
              alt=""
              style={{ width: '100%', maxHeight: '11rem', objectFit: 'cover', marginBottom: '1.1rem', border: '1px solid var(--color-surface)' }}
            />
          )}
          {tallasConStock(sizeStep.tallas).length === 0 ? (
            <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.85rem' }}>Sin stock disponible en ninguna talla.</p>
          ) : (
            <div className="flex flex-wrap" style={{ gap: '0.6rem' }}>
              {tallasConStock(sizeStep.tallas).map(([talla, stock]) => (
                <button
                  key={talla}
                  type="button"
                  onClick={() => elegirTalla(talla)}
                  className="font-serif"
                  style={{ padding: '0.75rem 1.1rem', border: '1px solid var(--color-surface)', fontSize: '1.1rem' }}
                >
                  {talla} <span className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.7rem' }}>({stock})</span>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

const Modal = ({ title, onClose, children }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center"
    style={{ background: 'rgba(10, 37, 64, 0.45)', padding: '1.5rem' }}
    onClick={onClose}
  >
    <div
      className="bg-[var(--color-paper)]"
      style={{ border: '1px solid var(--color-surface)', padding: '1.75rem', maxWidth: '28rem', width: '100%' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: '1.25rem' }}>
        <h3 className="font-serif text-[var(--color-ink)]" style={{ fontSize: '1.15rem', fontWeight: 400 }}>{title}</h3>
        <button type="button" onClick={onClose} style={{ color: 'var(--color-muted)' }}>✕</button>
      </div>
      {children}
    </div>
  </div>
)

export default VentaFisica
