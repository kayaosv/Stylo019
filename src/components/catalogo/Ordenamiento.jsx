const OPCIONES = [
  { value: 'categorias',  label: 'Categorías' },
  { value: 'novedad',     label: 'Novedades' },
  { value: 'precio_asc',  label: 'Precio ↑' },
  { value: 'precio_desc', label: 'Precio ↓' },
  { value: 'mas_vendidos', label: 'Más vendidos' },
]

export const Ordenamiento = ({ valor, onChange }) => (
  <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 overflow-x-auto scrollbar-none">
    <span className="label-xs text-[var(--color-muted)] hidden sm:inline shrink-0">
      Ordenar
    </span>
    <div className="flex gap-1 shrink-0">
      {OPCIONES.map((op) => {
        const activo = valor === op.value
        return (
          <button
            key={op.value}
            type="button"
            onClick={() => onChange(op.value)}
            className="label-xs px-3 py-1.5 transition-colors whitespace-nowrap"
            style={{
              color: activo ? 'var(--color-paper)' : 'var(--color-muted)',
              background: activo ? 'var(--color-ink)' : 'transparent',
              letterSpacing: '0.12em',
            }}
            data-cursor="link"
          >
            {op.label}
          </button>
        )
      })}
    </div>
  </div>
)
