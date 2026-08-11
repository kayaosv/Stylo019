import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchProductosAdmin,
  updateProducto,
  deleteProducto,
} from '@/services/productos'
import { fetchCategorias } from '@/services/categorias'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { ImpresionEtiquetas } from '@/components/admin/ImpresionEtiquetas'
import { claveDe, itemsDeProducto } from '@/services/etiquetas'

const TALLAS = ['XS', 'S', 'M', 'L', 'XL']

const sumStock = (tallas) =>
  TALLAS.reduce((acc, t) => acc + (Number(tallas?.[t]) || 0), 0)

const formatPrecio = (n) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format(Number(n) || 0)

const ProductosList = () => {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [categorias, setCategorias] = useState([])

  const [confirmTarget, setConfirmTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [etiquetaProducto, setEtiquetaProducto] = useState(null)
  const [etiquetaSeleccion, setEtiquetaSeleccion] = useState(new Set())
  const [imprimiendo, setImprimiendo] = useState(null)

  const abrirEtiquetas = (p) => {
    setEtiquetaProducto(p)
    setEtiquetaSeleccion(new Set(itemsDeProducto(p).map(claveDe)))
  }

  const cerrarEtiquetas = () => {
    setEtiquetaProducto(null)
    setEtiquetaSeleccion(new Set())
    setImprimiendo(null)
  }

  const toggleEtiquetaItem = (item) => {
    const key = claveDe(item)
    setEtiquetaSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const loadProductos = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await fetchProductosAdmin({
      categoria: categoria || null,
      busqueda: busqueda || null,
    })
    if (err) setError('Error cargando productos. Revisa tu conexión.')
    setProductos(data)
    setLoading(false)
  }, [categoria, busqueda])

  useEffect(() => {
    loadProductos()
  }, [loadProductos])

  useEffect(() => {
    fetchCategorias().then(({ data }) => setCategorias(data))
  }, [])

  // Optimistic toggle for boolean fields
  const handleToggle = async (producto, field) => {
    const previous = productos
    const nextValue = !producto[field]
    setProductos((prev) =>
      prev.map((p) => (p.id === producto.id ? { ...p, [field]: nextValue } : p)),
    )
    const { error: err } = await updateProducto(producto.id, {
      [field]: nextValue,
    })
    if (err) {
      setProductos(previous)
      setError('No se pudo actualizar. Inténtalo otra vez.')
    }
  }

  const handleDelete = async () => {
    if (!confirmTarget) return
    setDeleting(true)
    const { error: err } = await deleteProducto(confirmTarget.id)
    setDeleting(false)
    if (err) {
      setError('No se pudo eliminar el producto.')
      return
    }
    setProductos((prev) => prev.filter((p) => p.id !== confirmTarget.id))
    setConfirmTarget(null)
  }

  const stats = useMemo(
    () => ({
      total: productos.length,
      activos: productos.filter((p) => p.activo).length,
      destacados: productos.filter((p) => p.destacado).length,
      masVendidos: productos.filter((p) => p.mas_vendido).length,
    }),
    [productos],
  )

  return (
    <div className="flex flex-col" style={{ gap: '2.5rem' }}>
      {/* Header */}
      <div
        className="flex flex-wrap items-end justify-between"
        style={{ gap: '1.5rem' }}
      >
        <div>
          <span
            className="label-xs text-[var(--color-muted)]"
            style={{ letterSpacing: '0.25em' }}
          >
            Catálogo
          </span>
          <h1
            className="font-serif text-[var(--color-ink)]"
            style={{
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: 300,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              marginTop: '0.5rem',
            }}
          >
            Productos
          </h1>
        </div>

        <Link
          to="/admin/productos/nuevo"
          className="bg-[var(--color-ink)] font-sans text-[var(--color-paper)] transition-opacity hover:opacity-85"
          style={{
            padding: '0.95rem 1.5rem',
            fontSize: '0.72rem',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
          }}
        >
          + Nuevo producto
        </Link>
      </div>

      {/* Stats row */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
          gap: '1rem',
        }}
      >
        {[
          { label: 'Total', value: stats.total },
          { label: 'Activos', value: stats.activos },
          { label: 'Novedades', value: stats.destacados },
          { label: 'Más vendidos', value: stats.masVendidos },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[var(--color-paper)]"
            style={{
              padding: '1.25rem 1.5rem',
              border: '1px solid var(--color-surface)',
            }}
          >
            <span
              className="label-xs text-[var(--color-muted)] block"
              style={{ letterSpacing: '0.25em' }}
            >
              {stat.label}
            </span>
            <span
              className="font-serif text-[var(--color-ink)] block"
              style={{
                fontSize: '2rem',
                fontWeight: 300,
                letterSpacing: '-0.01em',
                marginTop: '0.25rem',
                lineHeight: 1,
              }}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap items-center"
        style={{ gap: '1rem' }}
      >
        <input
          type="text"
          placeholder="Buscar por nombre o descripción…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 bg-[var(--color-paper)] font-sans text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
          style={{
            border: '1px solid var(--color-surface)',
            padding: '0.85rem 1rem',
            fontSize: '0.9rem',
            minWidth: '14rem',
          }}
        />
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="bg-[var(--color-paper)] font-sans text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
          style={{
            border: '1px solid var(--color-surface)',
            padding: '0.85rem 1rem',
            fontSize: '0.9rem',
          }}
        >
          <option value="">Todas</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p
          className="font-sans text-red-600"
          style={{ fontSize: '0.85rem' }}
        >
          {error}
        </p>
      )}

      {/* List */}
      {loading ? (
        <div
          className="font-sans text-[var(--color-muted)]"
          style={{ fontSize: '0.85rem' }}
        >
          Cargando productos…
        </div>
      ) : productos.length === 0 ? (
        <div
          className="bg-[var(--color-paper)] text-center"
          style={{
            border: '1px solid var(--color-surface)',
            padding: '4rem 2rem',
          }}
        >
          <p
            className="font-serif text-[var(--color-muted)]"
            style={{ fontSize: '1.25rem', fontWeight: 300 }}
          >
            No hay productos todavía.
          </p>
        </div>
      ) : (
        <div
          className="bg-[var(--color-paper)]"
          style={{ border: '1px solid var(--color-surface)' }}
        >
          {/* Table head (desktop) */}
          <div
            className="hidden border-b border-[var(--color-surface)] md:grid"
            style={{
              gridTemplateColumns:
                '5.5rem minmax(0, 2.4fr) 1fr 0.9fr 0.9fr 1.4fr 1.2fr',
              padding: '1rem 1.25rem',
              gap: '1rem',
              alignItems: 'center',
            }}
          >
            {['', 'Producto', 'Categoría', 'Precio', 'Stock', 'Estado', ''].map(
              (label, i) => (
                <span
                  key={i}
                  className="label-xs text-[var(--color-muted)]"
                  style={{ letterSpacing: '0.22em' }}
                >
                  {label}
                </span>
              ),
            )}
          </div>

          {productos.map((p) => (
            <div
              key={p.id}
              className="border-b border-[var(--color-surface)] last:border-b-0"
            >
              {/* Mobile card layout */}
              <div
                className="flex gap-3 md:hidden"
                style={{ padding: '1rem' }}
              >
                {/* Thumbnail */}
                <div
                  className="bg-[var(--color-surface)] shrink-0"
                  style={{ width: '4rem', height: '5rem', overflow: 'hidden' }}
                >
                  <img
                    src={p.imagenes?.[0]}
                    alt={p.nombre}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Content */}
                <div className="flex flex-col justify-between flex-1" style={{ minWidth: 0 }}>
                  {/* Top: name + price */}
                  <div>
                    <span
                      className="font-serif text-[var(--color-ink)] block"
                      style={{ fontSize: '1rem', fontWeight: 400, lineHeight: 1.2 }}
                    >
                      {p.nombre}
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      {p.precio_oferta != null && p.precio_oferta < p.precio && (
                        <span
                          className="font-serif line-through"
                          style={{ fontSize: '0.72rem', color: '#dc2626' }}
                        >
                          {formatPrecio(p.precio)}
                        </span>
                      )}
                      <span
                        className="font-serif text-[var(--color-ink)]"
                        style={{ fontSize: '0.95rem', fontWeight: 400 }}
                      >
                        {formatPrecio(
                          p.precio_oferta != null && p.precio_oferta < p.precio
                            ? p.precio_oferta
                            : p.precio
                        )}
                      </span>
                      <span
                        className="label-xs text-[var(--color-muted)] capitalize"
                        style={{ letterSpacing: '0.1em' }}
                      >
                        · {p.categoria}
                      </span>
                    </div>
                  </div>

                  {/* Bottom: toggles + actions */}
                  <div className="flex items-center justify-between flex-wrap mt-2" style={{ gap: '0.4rem' }}>
                    <div className="flex items-center" style={{ gap: '0.35rem' }}>
                      <Toggle
                        label="Nov"
                        active={p.destacado}
                        onClick={() => handleToggle(p, 'destacado')}
                        title="Novedad"
                      />
                      <Toggle
                        label="Top"
                        active={p.mas_vendido}
                        onClick={() => handleToggle(p, 'mas_vendido')}
                        title="Más vendido"
                      />
                      <Toggle
                        label="On"
                        active={p.activo}
                        onClick={() => handleToggle(p, 'activo')}
                        title="Visible"
                      />
                    </div>
                    <div className="flex items-center" style={{ gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => abrirEtiquetas(p)}
                        className="font-sans text-[var(--color-ink)]"
                        style={{
                          fontSize: '0.65rem',
                          letterSpacing: '0.22em',
                          textTransform: 'uppercase',
                          padding: '0.5rem 0.75rem',
                          border: '1px solid var(--color-surface)',
                        }}
                      >
                        Etiqueta
                      </button>
                      <Link
                        to={`/admin/productos/${p.id}`}
                        className="font-sans text-[var(--color-ink)]"
                        style={{
                          fontSize: '0.65rem',
                          letterSpacing: '0.22em',
                          textTransform: 'uppercase',
                          padding: '0.5rem 0.75rem',
                          border: '1px solid var(--color-surface)',
                        }}
                      >
                        Editar
                      </Link>
                      <button
                        type="button"
                        onClick={() => setConfirmTarget(p)}
                        className="font-sans text-red-600"
                        style={{
                          fontSize: '0.65rem',
                          letterSpacing: '0.22em',
                          textTransform: 'uppercase',
                          padding: '0.5rem 0.75rem',
                          border: '1px solid rgba(220, 38, 38, 0.3)',
                        }}
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop row layout — unchanged */}
              <div
                className="hidden md:grid md:items-center"
                style={{
                  gridTemplateColumns:
                    '5.5rem minmax(0, 2.4fr) 1fr 0.9fr 0.9fr 1.4fr 1.2fr',
                  padding: '1.25rem',
                  gap: '1rem',
                }}
              >
                <div
                  className="bg-[var(--color-surface)]"
                  style={{ width: '4.5rem', height: '5.5rem', overflow: 'hidden', flexShrink: 0 }}
                >
                  <img
                    src={p.imagenes?.[0]}
                    alt={p.nombre}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <span
                    className="font-serif text-[var(--color-ink)] block"
                    style={{ fontSize: '1.1rem', fontWeight: 400, lineHeight: 1.2 }}
                  >
                    {p.nombre}
                  </span>
                  <span
                    className="font-sans text-[var(--color-muted)] block overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}
                  >
                    {p.descripcion}
                  </span>
                </div>

                <span
                  className="font-sans text-[var(--color-muted)]"
                  style={{ fontSize: '0.78rem', textTransform: 'capitalize', letterSpacing: '0.02em' }}
                >
                  {p.categoria}
                </span>

                <div className="flex flex-col">
                  {p.precio_oferta != null && p.precio_oferta < p.precio && (
                    <span
                      className="font-serif line-through"
                      style={{ fontSize: '0.78rem', fontWeight: 400, color: '#dc2626' }}
                    >
                      {formatPrecio(p.precio)}
                    </span>
                  )}
                  <span
                    className="font-serif text-[var(--color-ink)]"
                    style={{ fontSize: '1rem', fontWeight: 400 }}
                  >
                    {formatPrecio(
                      p.precio_oferta != null && p.precio_oferta < p.precio
                        ? p.precio_oferta
                        : p.precio
                    )}
                  </span>
                </div>

                <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: '0.85rem' }}>
                  {sumStock(p.tallas)}
                </span>

                <div className="flex flex-wrap items-center" style={{ gap: '0.5rem' }}>
                  <Toggle
                    label="Nov"
                    active={p.destacado}
                    onClick={() => handleToggle(p, 'destacado')}
                    title="Marcar como novedad"
                  />
                  <Toggle
                    label="Top"
                    active={p.mas_vendido}
                    onClick={() => handleToggle(p, 'mas_vendido')}
                    title="Más vendido"
                  />
                  <Toggle
                    label="On"
                    active={p.activo}
                    onClick={() => handleToggle(p, 'activo')}
                    title="Visible en la tienda"
                  />
                </div>

                <div className="flex items-center justify-end" style={{ gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => abrirEtiquetas(p)}
                    className="font-sans text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                    style={{
                      fontSize: '0.7rem',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      padding: '0.55rem 0.85rem',
                      border: '1px solid var(--color-surface)',
                    }}
                  >
                    Etiqueta
                  </button>
                  <Link
                    to={`/admin/productos/${p.id}`}
                    className="font-sans text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                    style={{
                      fontSize: '0.7rem',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      padding: '0.55rem 0.85rem',
                      border: '1px solid var(--color-surface)',
                    }}
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    onClick={() => setConfirmTarget(p)}
                    className="font-sans text-red-600 hover:text-red-700"
                    style={{
                      fontSize: '0.7rem',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      padding: '0.55rem 0.85rem',
                      border: '1px solid rgba(220, 38, 38, 0.3)',
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title="Eliminar producto"
        message={
          confirmTarget
            ? `"${confirmTarget.nombre}" se eliminará definitivamente del catálogo. Esta acción no se puede deshacer.`
            : ''
        }
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleDelete}
      />

      {etiquetaProducto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(10, 37, 64, 0.55)', padding: '1.5rem' }}
          onClick={cerrarEtiquetas}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[var(--color-paper)]"
            style={{ padding: '2rem', border: '1px solid var(--color-surface)', maxHeight: '85vh', overflowY: 'auto' }}
          >
            {imprimiendo ? (
              <ImpresionEtiquetas items={imprimiendo} onClose={() => setImprimiendo(null)} onDone={cerrarEtiquetas} />
            ) : (
              <div className="flex flex-col" style={{ gap: '1.25rem' }}>
                <div>
                  <span className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.25em' }}>
                    Imprimir etiqueta
                  </span>
                  <h3 className="font-serif text-[var(--color-ink)]" style={{ fontSize: '1.5rem', fontWeight: 300, marginTop: '0.25rem' }}>
                    {etiquetaProducto.nombre}
                  </h3>
                </div>

                <div className="flex flex-col" style={{ gap: '0.4rem' }}>
                  {itemsDeProducto(etiquetaProducto).map((item) => (
                    <label
                      key={claveDe(item)}
                      className="flex items-center transition-colors hover:bg-[var(--color-base)]"
                      style={{ gap: '0.65rem', padding: '0.5rem 0.75rem', border: '1px solid var(--color-surface)', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={etiquetaSeleccion.has(claveDe(item))}
                        onChange={() => toggleEtiquetaItem(item)}
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
                        {item.colorLabel ?? 'Base (sin color)'}
                      </span>
                      <span
                        className="font-sans text-[var(--color-muted)]"
                        style={{ fontSize: '0.72rem', marginLeft: 'auto', letterSpacing: '0.03em' }}
                      >
                        {item.barcode ?? 'Sin código'}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-end" style={{ gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={cerrarEtiquetas}
                    className="font-sans text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                    style={{ fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase', padding: '0.85rem 1rem' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={etiquetaSeleccion.size === 0}
                    onClick={() =>
                      setImprimiendo(itemsDeProducto(etiquetaProducto).filter((i) => etiquetaSeleccion.has(claveDe(i))))
                    }
                    className="bg-[var(--color-ink)] font-sans text-[var(--color-paper)] transition-opacity hover:opacity-85 disabled:opacity-50"
                    style={{ fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase', padding: '0.85rem 1.5rem' }}
                  >
                    Imprimir seleccionadas ({etiquetaSeleccion.size})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Small inline pill toggle for boolean flags
const Toggle = ({ label, active, onClick, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="font-sans transition-colors"
    style={{
      fontSize: '0.65rem',
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      padding: '0.45rem 0.65rem',
      border: active
        ? '1px solid var(--color-accent)'
        : '1px solid var(--color-surface)',
      backgroundColor: active ? 'var(--color-accent)' : 'transparent',
      color: active ? 'var(--color-paper)' : 'var(--color-muted)',
    }}
  >
    {label}
  </button>
)

export default ProductosList
