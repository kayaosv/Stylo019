import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  createCategoria,
  updateCategoria,
  deleteCategoria,
} from '@/services/categorias'
import { supabase } from '@/lib/supabase'

const fetchAll = async () => {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nombre, orden, activo')
    .order('orden')
  return { data: data ?? [], error }
}

// ── Drag handle icon ─────────────────────────────────────────────────────────
const DragHandle = ({ listeners, attributes }) => (
  <span
    {...listeners}
    {...attributes}
    title="Arrastrar para reordenar"
    aria-label="Arrastrar para reordenar"
    style={{
      cursor: 'grab',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: '1.5rem',
      color: 'var(--color-surface)',
      fontSize: '1rem',
      userSelect: 'none',
      touchAction: 'none',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-muted)')}
    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-surface)')}
  >
    ⠿
  </span>
)

// ── Sortable row ─────────────────────────────────────────────────────────────
const CategoriaRow = ({ item, isSaving, onToggle, onDelete, onEditStart, onEditSave, editingId, editNombre, setEditNombre }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const isEditing = editingId === item.id

  return (
    <li
      ref={setNodeRef}
      className="flex items-center gap-3 border border-[var(--color-surface)] bg-[var(--color-paper)]"
      style={{
        padding: '0.75rem 1rem',
        opacity: isSaving ? 0.5 : item.activo ? 1 : 0.45,
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? 'none' : transition,
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.12)' : 'none',
        zIndex: isDragging ? 10 : 'auto',
        position: 'relative',
      }}
    >
      <DragHandle listeners={listeners} attributes={attributes} />

      {/* Name / edit input */}
      {isEditing ? (
        <input
          autoFocus
          value={editNombre}
          onChange={(e) => setEditNombre(e.target.value)}
          onBlur={() => onEditSave(item)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEditSave(item)
            if (e.key === 'Escape') onEditStart(null)
          }}
          maxLength={60}
          className="flex-1 bg-transparent border-b border-[var(--color-ink)] text-[var(--color-ink)] font-sans focus:outline-none"
          style={{ fontSize: '0.9rem', padding: '0.1rem 0' }}
        />
      ) : (
        <span
          className="flex-1 font-sans text-[var(--color-ink)] cursor-pointer hover:text-[var(--color-accent)] transition-colors"
          style={{ fontSize: '0.9rem' }}
          onClick={() => onEditStart(item)}
          title="Clic para editar nombre"
        >
          {item.nombre}
        </span>
      )}

      {/* ID badge */}
      <span
        className="font-mono text-[var(--color-muted)] hidden sm:block"
        style={{ fontSize: '0.7rem', flexShrink: 0 }}
      >
        {item.id}
      </span>

      {/* Toggle active */}
      <button
        type="button"
        onClick={() => onToggle(item)}
        disabled={isSaving}
        aria-label={item.activo ? 'Desactivar' : 'Activar'}
        title={item.activo ? 'Visible en tienda' : 'Oculta en tienda'}
        className="transition-colors disabled:opacity-40"
        style={{
          fontSize: '0.72rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          padding: '0.3rem 0.6rem',
          border: '1px solid',
          borderColor: item.activo ? 'var(--color-surface)' : 'var(--color-ink)',
          color: item.activo ? 'var(--color-muted)' : 'var(--color-ink)',
          flexShrink: 0,
        }}
      >
        {item.activo ? 'ON' : 'OFF'}
      </button>

      {/* Delete */}
      <button
        type="button"
        onClick={() => onDelete(item)}
        disabled={isSaving}
        aria-label="Eliminar categoría"
        className="text-[var(--color-muted)] hover:text-red-500 disabled:opacity-40 transition-colors"
        style={{ fontSize: '1.1rem', flexShrink: 0, lineHeight: 1 }}
      >
        ×
      </button>
    </li>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
const Categorias = () => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)

  const [newNombre, setNewNombre] = useState('')
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editNombre, setEditNombre] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const load = async () => {
    setLoading(true)
    const { data, error } = await fetchAll()
    if (error) setError(error.message)
    else setItems(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const slugify = (str) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  const handleAdd = async (e) => {
    e.preventDefault()
    const nombre = newNombre.trim()
    if (!nombre) return
    setAdding(true)
    const maxOrden = items.length ? Math.max(...items.map((i) => i.orden)) : 0
    const { error } = await createCategoria({
      id: slugify(nombre),
      nombre,
      orden: maxOrden + 1,
      activo: true,
    })
    if (error) setError(error.message)
    else {
      setNewNombre('')
      await load()
    }
    setAdding(false)
  }

  // Optimistic local reorder → single batch update on drop
  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)

    // Optimistic update — no flicker
    setItems(reordered)

    // Persist new orden values in one batch
    const updates = reordered.map((item, idx) =>
      updateCategoria(item.id, { orden: idx + 1 })
    )
    await Promise.all(updates)
  }

  const handleToggle = async (item) => {
    setSaving(item.id)
    await updateCategoria(item.id, { activo: !item.activo })
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, activo: !i.activo } : i))
    )
    setSaving(null)
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer.`)) return
    setSaving(item.id)
    await deleteCategoria(item.id)
    setSaving(null)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
  }

  const handleEditStart = (item) => {
    if (!item) { setEditingId(null); return }
    setEditingId(item.id)
    setEditNombre(item.nombre)
  }

  const handleEditSave = async (item) => {
    const nombre = editNombre.trim()
    setEditingId(null)
    if (!nombre || nombre === item.nombre) return
    setSaving(item.id)
    await updateCategoria(item.id, { nombre })
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, nombre } : i))
    )
    setSaving(null)
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <span
          className="label-xs text-[var(--color-muted)]"
          style={{ letterSpacing: '0.25em' }}
        >
          Panel admin
        </span>
        <h1
          className="font-serif text-[var(--color-ink)]"
          style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 300, marginTop: '0.4rem' }}
        >
          Categorías
        </h1>
      </div>

      {error && (
        <p className="font-sans text-red-500" style={{ fontSize: '0.82rem', marginBottom: '1.25rem' }}>
          {error}
        </p>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-3" style={{ marginBottom: '2.5rem' }}>
        <input
          type="text"
          placeholder="Nueva categoría…"
          value={newNombre}
          onChange={(e) => setNewNombre(e.target.value)}
          maxLength={60}
          className="flex-1 bg-[var(--color-paper)] border border-[var(--color-surface)] text-[var(--color-ink)] font-sans placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-ink)] transition-colors"
          style={{ padding: '0.75rem 1rem', fontSize: '0.88rem' }}
        />
        <button
          type="submit"
          disabled={adding || !newNombre.trim()}
          className="bg-[var(--color-ink)] text-[var(--color-paper)] transition-opacity hover:opacity-85 disabled:opacity-40"
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '0.72rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {adding ? '…' : 'Añadir'}
        </button>
      </form>

      {/* Sortable list */}
      {loading ? (
        <p className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.2em' }}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.88rem' }}>No hay categorías todavía.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col" style={{ gap: '0.5rem' }}>
              {items.map((item) => (
                <CategoriaRow
                  key={item.id}
                  item={item}
                  isSaving={saving === item.id}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  editingId={editingId}
                  editNombre={editNombre}
                  setEditNombre={setEditNombre}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.78rem', marginTop: '1.5rem' }}>
        Arrastra el icono ⠿ para reordenar. Clic en el nombre para editar.
      </p>
    </div>
  )
}

export default Categorias
