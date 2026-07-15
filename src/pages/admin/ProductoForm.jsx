import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  fetchProductoAdmin,
  createProducto,
  updateProducto,
} from '@/services/productos'
import { ImageUploader } from '@/components/admin/ImageUploader'
import { COLORES_DISPONIBLES, getColorMeta } from '@/lib/colores'
import { TALLA_SETS, TIPO_TALLA_OPTIONS } from '@/lib/tallas'
import { fetchCategorias } from '@/services/categorias'

const emptyTallas = (tipo) => Object.fromEntries(TALLA_SETS[tipo].map((t) => [t, 0]))
const emptyPreciosTalla = (tipo) => Object.fromEntries(TALLA_SETS[tipo].map((t) => [t, '']))

const EMPTY_CUSTOM_SLOTS = (tipo = 'ropa') => [
  { id: 'custom-1', label: '', hex: '#ffffff', activo: false, imagenes: [], tallas: emptyTallas(tipo) },
  { id: 'custom-2', label: '', hex: '#ffffff', activo: false, imagenes: [], tallas: emptyTallas(tipo) },
]

const emptyForm = () => ({
  nombre: '',
  descripcion: '',
  precio: '',
  precio_oferta: '',
  categoria: '',
  tipo_talla: 'ropa',
  tallas: emptyTallas('ropa'),
  precios_talla: emptyPreciosTalla('ropa'),
  usarPreciosTalla: false,
  imagenes: [],
  usarColores: false,
  stockPorColor: false,
  colores: {},
  coloresCustom: EMPTY_CUSTOM_SLOTS('ropa'),
  destacado: false,
  mas_vendido: false,
  activo: true,
})

const parseStock = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

const ProductoForm = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState(emptyForm)
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    fetchCategorias().then(({ data }) => {
      setCategorias(data)
      if (!isEdit && data.length > 0) {
        setForm((f) => ({ ...f, categoria: f.categoria || data[0].id }))
      }
    })
  }, [isEdit])

  // Load existing product when editing
  useEffect(() => {
    if (!isEdit) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      const { data, error: err } = await fetchProductoAdmin(id)
      if (cancelled) return
      if (err || !data) {
        setError('No se pudo cargar el producto.')
        setLoading(false)
        return
      }
      const tipoTalla = data.tipo_talla || 'ropa'
      const tallasSet = TALLA_SETS[tipoTalla] ?? TALLA_SETS.ropa
      const pt = data.precios_talla ?? {}
      const hasPT = Object.keys(pt).length > 0
      const rawColores = Array.isArray(data.colores) ? data.colores : []
      const coloresMap = {}
      const coloresCustom = EMPTY_CUSTOM_SLOTS(tipoTalla)
      const tallasDeColor = (c) =>
        Object.fromEntries(tallasSet.map((t) => [t, Number(c?.tallas?.[t]) || 0]))

      rawColores.forEach((c) => {
        if (!c || typeof c.id !== 'string') return
        if (getColorMeta(c.id)) {
          // Fixed catalog color
          coloresMap[c.id] = {
            activo: true,
            imagenes: Array.isArray(c.imagenes) ? c.imagenes : [],
            tallas: tallasDeColor(c),
          }
        } else if (c.id === 'custom-1' || c.id === 'custom-2') {
          // Custom color — restore label, hex and images to its slot
          const idx = c.id === 'custom-1' ? 0 : 1
          coloresCustom[idx] = {
            id: c.id,
            label: typeof c.label === 'string' ? c.label : '',
            hex: typeof c.hex === 'string' ? c.hex : '#ffffff',
            activo: true,
            imagenes: Array.isArray(c.imagenes) ? c.imagenes : [],
            tallas: tallasDeColor(c),
          }
        }
      })

      const hasColores =
        Object.keys(coloresMap).length > 0 ||
        coloresCustom.some((c) => c.activo)

      // A product uses per-color stock if at least one color entry carried
      // its own `tallas` map in the DB (see migration 009_stock_por_color).
      const hasStockPorColor = rawColores.some(
        (c) => c && typeof c.tallas === 'object' && c.tallas !== null
      )

      setForm({
        nombre: data.nombre ?? '',
        descripcion: data.descripcion ?? '',
        precio: String(data.precio ?? ''),
        precio_oferta: data.precio_oferta ? String(data.precio_oferta) : '',
        categoria: data.categoria ?? '',
        tipo_talla: tipoTalla,
        tallas: Object.fromEntries(
          tallasSet.map((t) => [t, Number(data.tallas?.[t]) || 0])
        ),
        precios_talla: Object.fromEntries(
          tallasSet.map((t) => [t, pt[t] != null ? String(pt[t]) : ''])
        ),
        usarPreciosTalla: hasPT,
        imagenes: Array.isArray(data.imagenes) ? data.imagenes : [],
        usarColores: hasColores,
        stockPorColor: hasStockPorColor,
        colores: coloresMap,
        coloresCustom,
        destacado: !!data.destacado,
        mas_vendido: !!data.mas_vendido,
        activo: data.activo ?? true,
      })
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id, isEdit])

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const changeTipoTalla = (tipo) => {
    setForm((prev) => ({
      ...prev,
      tipo_talla: tipo,
      tallas: emptyTallas(tipo),
      precios_talla: emptyPreciosTalla(tipo),
      // Size set changed — per-color stock maps reset too, they'd otherwise
      // carry stale sizes that no longer match this product's talla type.
      colores: Object.fromEntries(
        Object.entries(prev.colores).map(([id, c]) => [id, { ...c, tallas: emptyTallas(tipo) }])
      ),
      coloresCustom: prev.coloresCustom.map((slot) => ({ ...slot, tallas: emptyTallas(tipo) })),
    }))
  }

  const updateTalla = (talla, value) => {
    setForm((prev) => ({
      ...prev,
      tallas: { ...prev.tallas, [talla]: parseStock(value) },
    }))
  }

  const updatePrecioTalla = (talla, value) => {
    setForm((prev) => ({
      ...prev,
      precios_talla: { ...prev.precios_talla, [talla]: value },
    }))
  }

  const toggleColor = (colorId) => {
    setForm((prev) => {
      const current = prev.colores[colorId]
      const next = { ...prev.colores }
      if (current?.activo) {
        next[colorId] = { ...current, activo: false }
      } else {
        next[colorId] = {
          activo: true,
          imagenes: current?.imagenes ?? [],
          tallas: current?.tallas ?? emptyTallas(prev.tipo_talla),
        }
      }
      return { ...prev, colores: next }
    })
  }

  const updateColorImagenes = (colorId, imagenes) => {
    setForm((prev) => ({
      ...prev,
      colores: {
        ...prev.colores,
        [colorId]: {
          activo: true,
          imagenes,
          tallas: prev.colores[colorId]?.tallas ?? emptyTallas(prev.tipo_talla),
        },
      },
    }))
  }

  const updateColorTalla = (colorId, talla, value) => {
    setForm((prev) => ({
      ...prev,
      colores: {
        ...prev.colores,
        [colorId]: {
          ...prev.colores[colorId],
          tallas: { ...prev.colores[colorId]?.tallas, [talla]: parseStock(value) },
        },
      },
    }))
  }

  const updateCustomSlot = (idx, field, value) => {
    setForm((prev) => ({
      ...prev,
      coloresCustom: prev.coloresCustom.map((slot, i) =>
        i === idx ? { ...slot, [field]: value } : slot
      ),
    }))
  }

  const updateCustomSlotImagenes = (idx, imagenes) => {
    setForm((prev) => ({
      ...prev,
      coloresCustom: prev.coloresCustom.map((slot, i) =>
        i === idx ? { ...slot, imagenes } : slot
      ),
    }))
  }

  const updateCustomSlotTalla = (idx, talla, value) => {
    setForm((prev) => ({
      ...prev,
      coloresCustom: prev.coloresCustom.map((slot, i) =>
        i === idx ? { ...slot, tallas: { ...slot.tallas, [talla]: parseStock(value) } } : slot
      ),
    }))
  }

  const validate = () => {
    const errors = {}
    if (!form.nombre.trim()) errors.nombre = 'Requerido'
    const precio = Number(form.precio)
    if (!Number.isFinite(precio) || precio <= 0) errors.precio = 'Precio inválido'
    if (!form.categoria) errors.categoria = 'Requerido'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return
    if (!validate()) return

    setError(null)
    setSubmitting(true)

    const precioOferta = form.precio_oferta ? Number(form.precio_oferta) : null

    // Build precios_talla: only include sizes with a valid number, null if toggle is off or empty
    const tallasSet = TALLA_SETS[form.tipo_talla] ?? TALLA_SETS.ropa
    let preciosTalla = null
    if (form.usarPreciosTalla) {
      const entries = tallasSet
        .filter((t) => form.precios_talla[t] !== '' && form.precios_talla[t] != null)
        .map((t) => [t, Number(form.precios_talla[t])])
        .filter(([, v]) => Number.isFinite(v) && v > 0)
      if (entries.length > 0) preciosTalla = Object.fromEntries(entries)
    }

    // Build colores: fixed + custom, only active entries with at least one image.
    // `tallas` is only attached per color when stock-per-color is enabled —
    // its presence is what the DB trigger uses to decide whether to aggregate
    // (see migration 009_stock_por_color).
    let coloresPayload = null
    if (form.usarColores) {
      const fijos = COLORES_DISPONIBLES
        .filter((c) => form.colores[c.id]?.activo)
        .map((c) => ({
          id: c.id,
          imagenes: (form.colores[c.id]?.imagenes ?? []).filter(Boolean),
          ...(form.stockPorColor ? { tallas: form.colores[c.id]?.tallas ?? {} } : {}),
        }))
        .filter((c) => c.imagenes.length > 0)

      const custom = form.coloresCustom
        .filter((c) => c.activo && c.label.trim().length > 0 && c.imagenes.length > 0)
        .map((c) => ({
          id: c.id,
          label: c.label.trim(),
          hex: c.hex,
          imagenes: c.imagenes.filter(Boolean),
          ...(form.stockPorColor ? { tallas: c.tallas ?? {} } : {}),
        }))

      const all = [...fijos, ...custom]
      if (all.length > 0) coloresPayload = all
    }

    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      precio: Number(form.precio),
      precio_oferta: precioOferta,
      categoria: form.categoria,
      tipo_talla: form.tipo_talla,
      tallas: form.tallas,
      precios_talla: preciosTalla,
      imagenes: form.imagenes,
      colores: coloresPayload,
      destacado: form.destacado,
      mas_vendido: form.mas_vendido,
      activo: form.activo,
    }

    const { error: err } = isEdit
      ? await updateProducto(id, payload)
      : await createProducto(payload)

    setSubmitting(false)

    if (err) {
      setError(err.message || 'No se pudo guardar. Inténtalo de nuevo.')
      return
    }

    navigate('/admin', { replace: true })
  }

  // Live total per size across every active color — mirrors the DB trigger's
  // aggregation so the read-only "Stock por talla" block matches what will
  // actually be saved.
  const totalPorTalla = (talla) => {
    const fijos = COLORES_DISPONIBLES
      .filter((c) => form.colores[c.id]?.activo)
      .map((c) => form.colores[c.id]?.tallas)
    const custom = form.coloresCustom.filter((c) => c.activo).map((c) => c.tallas)
    return [...fijos, ...custom].reduce((sum, t) => sum + (Number(t?.[talla]) || 0), 0)
  }

  if (loading) {
    return (
      <div
        className="font-sans text-[var(--color-muted)]"
        style={{ fontSize: '0.85rem' }}
      >
        Cargando producto…
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ gap: '2.5rem' }}>
      {/* Header */}
      <div
        className="flex flex-wrap items-end justify-between"
        style={{ gap: '1.5rem' }}
      >
        <div>
          <Link
            to="/admin"
            className="label-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            style={{ letterSpacing: '0.25em' }}
          >
            ← Volver a productos
          </Link>
          <h1
            className="font-serif text-[var(--color-ink)]"
            style={{
              fontSize: 'clamp(2.25rem, 4.5vw, 3.5rem)',
              fontWeight: 300,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              marginTop: '0.65rem',
            }}
          >
            {isEdit ? 'Editar producto' : 'Nuevo producto'}
          </h1>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col"
        style={{ gap: '2.5rem' }}
      >
        {/* Basic info */}
        <Section title="Información básica">
          <div
            className="grid"
            style={{
              gridTemplateColumns: '1fr',
              gap: '1.5rem',
            }}
          >
            <Field
              label="Nombre"
              required
              error={fieldErrors.nombre}
            >
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => updateField('nombre', e.target.value)}
                placeholder="Vestido Lino Sevilla"
                className="w-full bg-[var(--color-paper)] font-sans text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                style={{
                  border: '1px solid var(--color-surface)',
                  padding: '0.85rem 1rem',
                  fontSize: '0.95rem',
                }}
              />
            </Field>

            <Field label="Descripción">
              <textarea
                rows={4}
                value={form.descripcion}
                onChange={(e) => updateField('descripcion', e.target.value)}
                placeholder="Vestido de lino artesanal, corte fluido…"
                className="w-full bg-[var(--color-paper)] font-sans text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                style={{
                  border: '1px solid var(--color-surface)',
                  padding: '0.85rem 1rem',
                  fontSize: '0.95rem',
                  resize: 'vertical',
                  minHeight: '6rem',
                  lineHeight: 1.55,
                }}
              />
            </Field>

            <div
              className="grid"
              style={{
                gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
                gap: '1.5rem',
              }}
            >
              <Field
                label="Precio (€)"
                required
                error={fieldErrors.precio}
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio}
                  onChange={(e) => updateField('precio', e.target.value)}
                  placeholder="89.00"
                  className="w-full bg-[var(--color-paper)] font-sans text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                  style={{
                    border: '1px solid var(--color-surface)',
                    padding: '0.85rem 1rem',
                    fontSize: '0.95rem',
                  }}
                />
              </Field>

              <Field
                label="Precio oferta (€)"
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio_oferta}
                  onChange={(e) => updateField('precio_oferta', e.target.value)}
                  placeholder="Dejar vacío si no hay oferta"
                  className="w-full bg-[var(--color-paper)] font-sans text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                  style={{
                    border: '1px solid var(--color-surface)',
                    padding: '0.85rem 1rem',
                    fontSize: '0.95rem',
                  }}
                />
              </Field>

              <Field
                label="Categoría"
                required
                error={fieldErrors.categoria}
              >
                <select
                  value={form.categoria}
                  onChange={(e) => updateField('categoria', e.target.value)}
                  className="w-full bg-[var(--color-paper)] font-sans text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                  style={{
                    border: '1px solid var(--color-surface)',
                    padding: '0.85rem 1rem',
                    fontSize: '0.95rem',
                  }}
                >
                  <option value="" disabled>Selecciona categoría…</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Tipo de talla">
                <select
                  value={form.tipo_talla}
                  onChange={(e) => changeTipoTalla(e.target.value)}
                  className="w-full bg-[var(--color-paper)] font-sans text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                  style={{
                    border: '1px solid var(--color-surface)',
                    padding: '0.85rem 1rem',
                    fontSize: '0.95rem',
                  }}
                >
                  {TIPO_TALLA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </Section>

        {/* Stock by talla */}
        <Section
          title="Stock por talla"
          hint={
            form.usarColores && form.stockPorColor
              ? 'Total calculado automáticamente sumando el stock de cada color — edítalo en la sección de colores.'
              : 'Unidades disponibles. 0 = agotada esa talla.'
          }
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(7rem, 1fr))',
              gap: '1rem',
            }}
          >
            {(TALLA_SETS[form.tipo_talla] ?? TALLA_SETS.ropa).map((talla) =>
              form.usarColores && form.stockPorColor ? (
                <Field key={talla} label={talla}>
                  <div
                    className="w-full bg-[var(--color-surface)] font-serif text-[var(--color-ink)] text-center"
                    style={{
                      border: '1px solid var(--color-surface)',
                      padding: '1rem 0.75rem',
                      fontSize: '1.4rem',
                      fontWeight: 300,
                    }}
                  >
                    {totalPorTalla(talla)}
                  </div>
                </Field>
              ) : (
                <Field key={talla} label={talla}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.tallas[talla] ?? 0}
                    onChange={(e) => updateTalla(talla, e.target.value)}
                    className="w-full bg-[var(--color-paper)] font-serif text-[var(--color-ink)] text-center outline-none focus:border-[var(--color-accent)]"
                    style={{
                      border: '1px solid var(--color-surface)',
                      padding: '1rem 0.75rem',
                      fontSize: '1.4rem',
                      fontWeight: 300,
                    }}
                  />
                </Field>
              )
            )}
          </div>
        </Section>

        {/* Per-size pricing (optional) */}
        <Section
          title="Precio por talla"
          hint="Activa esta opción solo si alguna talla tiene un precio diferente al precio base."
        >
          <div className="flex flex-col" style={{ gap: '1.25rem' }}>
            <FlagRow
              label="Usar precio diferente por talla"
              hint="Las tallas sin precio usarán el precio base del producto"
              checked={form.usarPreciosTalla}
              onChange={(v) => updateField('usarPreciosTalla', v)}
            />

            {form.usarPreciosTalla && (
              <div
                className="grid"
                style={{
                  gridTemplateColumns: 'repeat(auto-fit, minmax(7rem, 1fr))',
                  gap: '1rem',
                }}
              >
                {(TALLA_SETS[form.tipo_talla] ?? TALLA_SETS.ropa).map((talla) => (
                  <Field key={talla} label={`${talla} (€)`}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.precios_talla[talla] ?? ''}
                      onChange={(e) => updatePrecioTalla(talla, e.target.value)}
                      placeholder={form.precio || '—'}
                      className="w-full bg-[var(--color-paper)] font-serif text-[var(--color-ink)] text-center outline-none focus:border-[var(--color-accent)]"
                      style={{
                        border: '1px solid var(--color-surface)',
                        padding: '1rem 0.75rem',
                        fontSize: '1.4rem',
                        fontWeight: 300,
                      }}
                    />
                  </Field>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* Color variants (optional) */}
        <Section
          title="Variantes de color"
          hint="Actívalo solo si este producto se ofrece en varios colores. Cada color necesita al menos una foto."
        >
          <div className="flex flex-col" style={{ gap: '1.25rem' }}>
            <FlagRow
              label="Usar variantes de color"
              hint="La clienta verá únicamente los colores con fotos cargadas"
              checked={form.usarColores}
              onChange={(v) => updateField('usarColores', v)}
            />

            {form.usarColores && (
              <FlagRow
                label="Stock independiente por color"
                hint="Cada color tendrá su propio stock por talla — el total de arriba se calcula solo"
                checked={form.stockPorColor}
                onChange={(v) => updateField('stockPorColor', v)}
              />
            )}

            {form.usarColores && (
              <div className="flex flex-col" style={{ gap: '1rem' }}>
                <div
                  className="flex flex-wrap"
                  style={{ gap: '0.6rem' }}
                >
                  {COLORES_DISPONIBLES.map((c) => {
                    const active = !!form.colores[c.id]?.activo
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleColor(c.id)}
                        className="flex items-center font-sans transition-colors"
                        style={{
                          gap: '0.55rem',
                          padding: '0.55rem 0.9rem',
                          border: active
                            ? '1px solid var(--color-ink)'
                            : '1px solid var(--color-surface)',
                          backgroundColor: active
                            ? 'var(--color-ink)'
                            : 'var(--color-base)',
                          color: active
                            ? 'var(--color-paper)'
                            : 'var(--color-muted)',
                          fontSize: '0.72rem',
                          letterSpacing: '0.22em',
                          textTransform: 'uppercase',
                        }}
                      >
                        <span
                          style={{
                            width: '0.9rem',
                            height: '0.9rem',
                            borderRadius: '9999px',
                            background: c.hex,
                            border: c.border
                              ? '1px solid rgba(0,0,0,0.2)'
                              : 'none',
                            display: 'inline-block',
                          }}
                        />
                        {c.label}
                      </button>
                    )
                  })}
                </div>

                {COLORES_DISPONIBLES.filter(
                  (c) => form.colores[c.id]?.activo
                ).map((c) => (
                  <div
                    key={c.id}
                    className="bg-[var(--color-base)]"
                    style={{
                      border: '1px solid var(--color-surface)',
                      padding: '1.25rem',
                    }}
                  >
                    <div
                      className="flex items-center"
                      style={{ gap: '0.65rem', marginBottom: '1rem' }}
                    >
                      <span
                        style={{
                          width: '1.1rem',
                          height: '1.1rem',
                          borderRadius: '9999px',
                          background: c.hex,
                          border: c.border
                            ? '1px solid rgba(0,0,0,0.2)'
                            : 'none',
                          display: 'inline-block',
                        }}
                      />
                      <h3
                        className="font-serif text-[var(--color-ink)]"
                        style={{ fontSize: '1.05rem', fontWeight: 400 }}
                      >
                        {c.label}
                      </h3>
                    </div>
                    <ImageUploader
                      value={form.colores[c.id]?.imagenes ?? []}
                      onChange={(next) => updateColorImagenes(c.id, next)}
                    />
                    {form.stockPorColor && (
                      <div
                        className="grid"
                        style={{
                          gridTemplateColumns: 'repeat(auto-fit, minmax(5.5rem, 1fr))',
                          gap: '0.75rem',
                          marginTop: '1rem',
                          paddingTop: '1rem',
                          borderTop: '1px solid var(--color-surface)',
                        }}
                      >
                        {(TALLA_SETS[form.tipo_talla] ?? TALLA_SETS.ropa).map((talla) => (
                          <Field key={talla} label={talla}>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={form.colores[c.id]?.tallas?.[talla] ?? 0}
                              onChange={(e) => updateColorTalla(c.id, talla, e.target.value)}
                              className="w-full bg-[var(--color-paper)] font-serif text-[var(--color-ink)] text-center outline-none focus:border-[var(--color-accent)]"
                              style={{
                                border: '1px solid var(--color-surface)',
                                padding: '0.65rem 0.5rem',
                                fontSize: '1.1rem',
                                fontWeight: 300,
                              }}
                            />
                          </Field>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {Object.values(form.colores).every((v) => !v?.activo) &&
                  form.coloresCustom.every((c) => !c.activo) && (
                  <p
                    className="font-sans text-[var(--color-muted)]"
                    style={{ fontSize: '0.78rem' }}
                  >
                    Selecciona al menos un color para subir sus fotos.
                  </p>
                )}

                {/* Custom color slots */}
                <div
                  className="flex flex-col"
                  style={{
                    gap: '0.75rem',
                    borderTop: '1px solid var(--color-surface)',
                    paddingTop: '1.25rem',
                    marginTop: '0.25rem',
                  }}
                >
                  <p
                    className="label-xs text-[var(--color-muted)]"
                    style={{ letterSpacing: '0.22em' }}
                  >
                    Colores personalizados
                  </p>

                  {form.coloresCustom.map((slot, idx) => (
                    <div key={slot.id} className="flex flex-col" style={{ gap: '0.75rem' }}>
                      {/* Slot header: toggle + name + picker */}
                      <div className="flex flex-wrap items-center" style={{ gap: '0.65rem' }}>
                        {/* Active toggle */}
                        <button
                          type="button"
                          onClick={() => updateCustomSlot(idx, 'activo', !slot.activo)}
                          className="font-sans transition-colors"
                          style={{
                            fontSize: '0.65rem',
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            padding: '0.5rem 0.75rem',
                            border: slot.activo
                              ? '1px solid var(--color-accent)'
                              : '1px solid var(--color-surface)',
                            backgroundColor: slot.activo ? 'var(--color-accent)' : 'transparent',
                            color: slot.activo ? 'var(--color-paper)' : 'var(--color-muted)',
                            flexShrink: 0,
                          }}
                        >
                          {slot.activo ? 'Activo' : 'Inactivo'}
                        </button>

                        {/* Color swatch + picker */}
                        <div className="relative flex items-center" style={{ gap: '0.4rem' }}>
                          <span
                            style={{
                              width: '1.4rem',
                              height: '1.4rem',
                              borderRadius: '9999px',
                              background: slot.hex,
                              border: '1px solid rgba(0,0,0,0.15)',
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                          <input
                            type="color"
                            value={slot.hex}
                            onChange={(e) => updateCustomSlot(idx, 'hex', e.target.value)}
                            title="Elegir color"
                            style={{
                              width: '1.4rem',
                              height: '1.4rem',
                              border: 'none',
                              padding: 0,
                              background: 'none',
                              cursor: 'pointer',
                              opacity: 0,
                              position: 'absolute',
                              left: 0,
                              top: 0,
                            }}
                          />
                        </div>

                        {/* Name input */}
                        <input
                          type="text"
                          value={slot.label}
                          onChange={(e) => updateCustomSlot(idx, 'label', e.target.value)}
                          placeholder={`Ej: Verde agua, Rosa empolvado…`}
                          className="bg-[var(--color-paper)] font-sans text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                          style={{
                            border: '1px solid var(--color-surface)',
                            padding: '0.55rem 0.85rem',
                            fontSize: '0.85rem',
                            flex: '1 1 12rem',
                            minWidth: '10rem',
                          }}
                        />

                        {/* Hex value — readonly display */}
                        <span
                          className="font-sans text-[var(--color-muted)]"
                          style={{ fontSize: '0.72rem', letterSpacing: '0.08em' }}
                        >
                          {slot.hex.toUpperCase()}
                        </span>
                      </div>

                      {/* Image uploader — only when slot is active and has a name */}
                      {slot.activo && slot.label.trim().length > 0 && (
                        <div
                          className="bg-[var(--color-base)]"
                          style={{
                            border: '1px solid var(--color-surface)',
                            padding: '1.25rem',
                            marginLeft: '0.25rem',
                          }}
                        >
                          <div
                            className="flex items-center"
                            style={{ gap: '0.65rem', marginBottom: '1rem' }}
                          >
                            <span
                              style={{
                                width: '1.1rem',
                                height: '1.1rem',
                                borderRadius: '9999px',
                                background: slot.hex,
                                border: '1px solid rgba(0,0,0,0.15)',
                                display: 'inline-block',
                              }}
                            />
                            <h3
                              className="font-serif text-[var(--color-ink)]"
                              style={{ fontSize: '1.05rem', fontWeight: 400 }}
                            >
                              {slot.label}
                            </h3>
                          </div>
                          <ImageUploader
                            value={slot.imagenes}
                            onChange={(next) => updateCustomSlotImagenes(idx, next)}
                          />
                          {form.stockPorColor && (
                            <div
                              className="grid"
                              style={{
                                gridTemplateColumns: 'repeat(auto-fit, minmax(5.5rem, 1fr))',
                                gap: '0.75rem',
                                marginTop: '1rem',
                                paddingTop: '1rem',
                                borderTop: '1px solid var(--color-surface)',
                              }}
                            >
                              {(TALLA_SETS[form.tipo_talla] ?? TALLA_SETS.ropa).map((talla) => (
                                <Field key={talla} label={talla}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={slot.tallas?.[talla] ?? 0}
                                    onChange={(e) => updateCustomSlotTalla(idx, talla, e.target.value)}
                                    className="w-full bg-[var(--color-paper)] font-serif text-[var(--color-ink)] text-center outline-none focus:border-[var(--color-accent)]"
                                    style={{
                                      border: '1px solid var(--color-surface)',
                                      padding: '0.65rem 0.5rem',
                                      fontSize: '1.1rem',
                                      fontWeight: 300,
                                    }}
                                  />
                                </Field>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {slot.activo && slot.label.trim().length === 0 && (
                        <p
                          className="font-sans text-[var(--color-muted)]"
                          style={{ fontSize: '0.75rem', marginLeft: '0.25rem' }}
                        >
                          Añade un nombre para activar la subida de fotos.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Flags */}
        <Section title="Visibilidad y destacados">
          <div className="flex flex-col" style={{ gap: '1rem' }}>
            <FlagRow
              label="Novedad"
              hint="Aparece en el carrusel de novedades del home"
              checked={form.destacado}
              onChange={(v) => updateField('destacado', v)}
            />
            <FlagRow
              label="Más vendido"
              hint="Aparece en la sección de más vendidos del home"
              checked={form.mas_vendido}
              onChange={(v) => updateField('mas_vendido', v)}
            />
            <FlagRow
              label="Visible en la tienda"
              hint="Desactívalo para ocultar sin borrarlo"
              checked={form.activo}
              onChange={(v) => updateField('activo', v)}
            />
          </div>
        </Section>

        {/* Images */}
        <Section
          title="Imágenes"
          hint="Arrastra fotos o selecciónalas. La primera será la principal."
        >
          <ImageUploader
            value={form.imagenes}
            onChange={(next) => updateField('imagenes', next)}
          />
        </Section>

        {error && (
          <p
            className="font-sans text-red-600"
            style={{ fontSize: '0.85rem' }}
          >
            {error}
          </p>
        )}

        {/* Actions */}
        <div
          className="flex items-center justify-end border-t border-[var(--color-surface)]"
          style={{ gap: '0.75rem', paddingTop: '2rem' }}
        >
          <Link
            to="/admin"
            className="font-sans text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            style={{
              fontSize: '0.72rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              padding: '0.95rem 1.25rem',
            }}
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="bg-[var(--color-ink)] font-sans text-[var(--color-paper)] transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{
              fontSize: '0.72rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              padding: '0.95rem 1.75rem',
            }}
          >
            {submitting
              ? 'Guardando…'
              : isEdit
                ? 'Guardar cambios'
                : 'Crear producto'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Presentational helpers ───

const Section = ({ title, hint, children }) => (
  <section
    className="bg-[var(--color-paper)]"
    style={{
      border: '1px solid var(--color-surface)',
      padding: 'clamp(1.5rem, 3vw, 2.25rem)',
    }}
  >
    <div style={{ marginBottom: '1.75rem' }}>
      <h2
        className="font-serif text-[var(--color-ink)]"
        style={{
          fontSize: '1.25rem',
          fontWeight: 400,
          letterSpacing: '-0.005em',
        }}
      >
        {title}
      </h2>
      {hint && (
        <p
          className="font-sans text-[var(--color-muted)]"
          style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}
        >
          {hint}
        </p>
      )}
    </div>
    {children}
  </section>
)

const Field = ({ label, required, error, children }) => (
  <label className="flex flex-col" style={{ gap: '0.5rem' }}>
    <span
      className="label-xs text-[var(--color-muted)]"
      style={{ letterSpacing: '0.22em' }}
    >
      {label}
      {required && (
        <span className="text-[var(--color-accent)]" style={{ marginLeft: '0.35rem' }}>
          ·
        </span>
      )}
    </span>
    {children}
    {error && (
      <span
        className="font-sans text-red-600"
        style={{ fontSize: '0.72rem', letterSpacing: '0.02em' }}
      >
        {error}
      </span>
    )}
  </label>
)

const FlagRow = ({ label, hint, checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="flex items-center justify-between bg-[var(--color-base)] text-left transition-colors hover:bg-[var(--color-surface)]"
    style={{
      border: '1px solid var(--color-surface)',
      padding: '1rem 1.25rem',
      gap: '1rem',
    }}
  >
    <div style={{ minWidth: 0 }}>
      <span
        className="font-serif text-[var(--color-ink)] block"
        style={{ fontSize: '1.05rem', fontWeight: 400 }}
      >
        {label}
      </span>
      <span
        className="font-sans text-[var(--color-muted)] block"
        style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}
      >
        {hint}
      </span>
    </div>
    <span
      className="font-sans"
      style={{
        fontSize: '0.65rem',
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        padding: '0.55rem 0.85rem',
        border: checked
          ? '1px solid var(--color-accent)'
          : '1px solid var(--color-muted)',
        backgroundColor: checked ? 'var(--color-accent)' : 'transparent',
        color: checked ? 'var(--color-paper)' : 'var(--color-muted)',
        flexShrink: 0,
      }}
    >
      {checked ? 'Sí' : 'No'}
    </span>
  </button>
)

export default ProductoForm
