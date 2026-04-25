// Strip that shows active filters as dismissible chips above the product grid.
// Each chip removes only its own filter; "Limpiar todo" removes all.
export const FiltrosActivos = ({ filtros, onQuitarFiltro, onLimpiar }) => {
  const chips = []

  if (filtros.busqueda) {
    chips.push({
      key: 'busqueda',
      label: `"${filtros.busqueda}"`,
      onRemove: () => onQuitarFiltro('busqueda'),
    })
  }

  if (filtros.categoria) {
    chips.push({
      key: 'categoria',
      label: filtros.categoria.charAt(0).toUpperCase() + filtros.categoria.slice(1),
      onRemove: () => onQuitarFiltro('categoria'),
    })
  }

  if (filtros.tallaDisponible) {
    chips.push({
      key: 'talla',
      label: `Talla ${filtros.tallaDisponible}`,
      onRemove: () => onQuitarFiltro('tallaDisponible'),
    })
  }

  if (filtros.precioMin != null || filtros.precioMax != null) {
    const desde = filtros.precioMin != null ? `€${filtros.precioMin}` : '€0'
    const hasta = filtros.precioMax != null ? `€${filtros.precioMax}` : '...'
    chips.push({
      key: 'precio',
      label: `${desde} — ${hasta}`,
      onRemove: () => {
        onQuitarFiltro('precioMin')
        onQuitarFiltro('precioMax')
      },
    })
  }

  if (!chips.length) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex items-center gap-2 label-xs border px-3 py-1.5 transition-colors duration-200"
          style={{
            borderColor: 'var(--color-surface)',
            color: 'var(--color-ink)',
            letterSpacing: '0.1em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-ink)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-surface)'
          }}
        >
          {chip.label}
          <span
            aria-hidden
            style={{ fontSize: '0.75rem', lineHeight: 1, opacity: 0.6 }}
          >
            ×
          </span>
        </button>
      ))}

      {chips.length > 1 && (
        <button
          type="button"
          onClick={onLimpiar}
          className="label-xs transition-colors duration-200"
          style={{ color: 'var(--color-muted)', letterSpacing: '0.1em' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-ink)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted)')}
        >
          Limpiar todo
        </button>
      )}
    </div>
  )
}
