import { useState, useEffect } from 'react'
import { fetchSetting, updateSetting } from '@/services/settings'

const DEFAULT_ZONES = [
  { id: 'sevilla',       nombre: 'Sevilla capital',    precio: 5.90,  activo: true  },
  { id: 'provincia',     nombre: 'Provincia Sevilla',  precio: 6.90,  activo: true  },
  { id: 'peninsular',    nombre: 'Península',          precio: 6.90,  activo: true  },
  { id: 'baleares',      nombre: 'Baleares',           precio: 9.90,  activo: true  },
  { id: 'canarias',      nombre: 'Canarias',           precio: 12.90, activo: true  },
  { id: 'internacional', nombre: 'Internacional',      precio: null,  activo: false },
]

const Toggle = ({ value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    style={{
      width: '2.25rem',
      height: '1.25rem',
      borderRadius: '0.625rem',
      background: value ? 'var(--color-accent)' : 'var(--color-surface)',
      position: 'relative',
      border: 'none',
      cursor: 'pointer',
      flexShrink: 0,
      transition: 'background 0.2s',
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: '2px',
        left: value ? 'calc(100% - 1.05rem)' : '2px',
        width: '1rem',
        height: '1rem',
        borderRadius: '50%',
        background: 'var(--color-paper)',
        transition: 'left 0.2s',
      }}
    />
  </button>
)

const Envios = () => {
  const [zonas, setZonas]   = useState(DEFAULT_ZONES)
  const [umbral, setUmbral] = useState(50)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  useEffect(() => {
    const load = async () => {
      const [rZonas, rUmbral] = await Promise.all([
        fetchSetting('envios_zonas'),
        fetchSetting('envio_gratis_umbral'),
      ])
      if (rZonas.data)      setZonas(rZonas.data)
      if (rUmbral.data != null) setUmbral(rUmbral.data)
      setLoading(false)
    }
    load()
  }, [])

  const updateZona = (id, field, value) =>
    setZonas((prev) => prev.map((z) => (z.id === id ? { ...z, [field]: value } : z)))

  const handleSave = async () => {
    setSaving(true)
    await Promise.all([
      updateSetting('envios_zonas', zonas),
      updateSetting('envio_gratis_umbral', Number(umbral)),
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return (
    <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Cargando…</p>
  )

  return (
    <div style={{ maxWidth: '640px' }}>

      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <span className="label-xs" style={{ color: 'var(--color-accent)', letterSpacing: '0.3em' }}>
          Configuración
        </span>
        <h1
          className="font-serif"
          style={{ fontSize: '2rem', fontWeight: 300, letterSpacing: '-0.02em', marginTop: '0.3rem', color: 'var(--color-ink)' }}
        >
          Zonas de envío
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.5rem', lineHeight: 1.6 }}>
          Las zonas activas con precio aparecen como opciones en el checkout de Stripe.
          Las zonas sin precio (como Internacional) no se muestran — el cliente consulta por WhatsApp.
        </p>
      </div>

      {/* Free shipping threshold */}
      <div
        className="border border-[var(--color-surface)] bg-[var(--color-paper)]"
        style={{ padding: '1.5rem', marginBottom: '2rem' }}
      >
        <label
          className="label-xs"
          style={{ color: 'var(--color-muted)', letterSpacing: '0.2em', display: 'block', marginBottom: '0.75rem' }}
        >
          Umbral envío gratis
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <input
            type="number"
            min="0"
            step="1"
            value={umbral}
            onChange={(e) => setUmbral(e.target.value)}
            className="border border-[var(--color-surface)] bg-[var(--color-base)]"
            style={{
              width: '6rem',
              padding: '0.6rem 0.75rem',
              fontSize: '0.9rem',
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            € — por encima de este importe el envío es gratis para todas las zonas
          </span>
        </div>
      </div>

      {/* Zones list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2.25rem 1fr 7rem',
            gap: '1rem',
            padding: '0 1.5rem 0.5rem',
            alignItems: 'center',
          }}
        >
          <span />
          <span className="label-xs" style={{ color: 'var(--color-muted)', letterSpacing: '0.2em' }}>Zona</span>
          <span className="label-xs" style={{ color: 'var(--color-muted)', letterSpacing: '0.2em', textAlign: 'right' }}>Precio</span>
        </div>

        {zonas.map((zona) => (
          <div
            key={zona.id}
            className="border border-[var(--color-surface)] bg-[var(--color-paper)]"
            style={{
              padding: '1rem 1.5rem',
              display: 'grid',
              gridTemplateColumns: '2.25rem 1fr 7rem',
              gap: '1rem',
              alignItems: 'center',
              opacity: zona.activo ? 1 : 0.45,
              transition: 'opacity 0.2s',
            }}
          >
            <Toggle
              value={zona.activo}
              onChange={(v) => updateZona(zona.id, 'activo', v)}
            />

            <span style={{ fontSize: '0.9rem', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)' }}>
              {zona.nombre}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="—"
                value={zona.precio ?? ''}
                onChange={(e) =>
                  updateZona(zona.id, 'precio', e.target.value === '' ? null : Number(e.target.value))
                }
                disabled={!zona.activo}
                className="border border-[var(--color-surface)] bg-[var(--color-base)]"
                style={{
                  width: '5.5rem',
                  padding: '0.45rem 0.6rem',
                  fontSize: '0.85rem',
                  textAlign: 'right',
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', flexShrink: 0 }}>€</span>
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '0.72rem', color: 'var(--color-muted-soft)', marginBottom: '2rem', lineHeight: 1.6 }}>
        Stripe admite un máximo de 5 opciones de envío por sesión. Las zonas sin precio quedan excluidas del conteo.
      </p>

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="bg-[var(--color-ink)] text-[var(--color-paper)] transition-opacity hover:opacity-85 disabled:opacity-50"
        style={{
          padding: '0.9rem 2.5rem',
          fontSize: '0.72rem',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-sans)',
          cursor: saving ? 'default' : 'pointer',
        }}
      >
        {saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar cambios'}
      </button>
    </div>
  )
}

export default Envios
