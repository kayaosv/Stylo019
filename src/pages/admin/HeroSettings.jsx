import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchSetting, updateSetting } from '@/services/settings'
import {
  uploadProductImage,
  deleteProductImage,
  extractPathFromPublicUrl,
  validateImageFile,
} from '@/services/storage'
import { HERO_PLACEHOLDER } from '@/lib/placeholderImages'

const SETTING_KEY   = 'hero_image'
const CONFIG_KEY    = 'hero_image_config'

const DEFAULT_CONFIG = { maxHeight: '78vh', aspectRatio: '4/5', objectFit: 'cover' }

const RATIOS = [
  { value: '3/4',  label: '3:4' },
  { value: '4/5',  label: '4:5' },
  { value: '1/1',  label: '1:1' },
  { value: '16/9', label: '16:9' },
]

const RadioGroup = ({ label, options, value, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    <span className="label-xs" style={{ color: 'var(--color-muted)', letterSpacing: '0.2em' }}>
      {label}
    </span>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {options.map((opt) => (
        <label
          key={opt.value}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
            padding: '0.45rem 0.85rem',
            border: `1px solid ${value === opt.value ? 'var(--color-ink)' : 'var(--color-surface)'}`,
            background: value === opt.value ? 'var(--color-ink)' : 'var(--color-paper)',
            transition: 'all 0.15s',
          }}
        >
          <input
            type="radio"
            name={label}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            style={{ display: 'none' }}
          />
          <span
            style={{
              fontSize: '0.78rem',
              fontFamily: 'var(--font-sans)',
              color: value === opt.value ? 'var(--color-paper)' : 'var(--color-ink)',
              letterSpacing: '0.05em',
            }}
          >
            {opt.label}
          </span>
        </label>
      ))}
    </div>
  </div>
)

const HeroSettings = () => {
  const [imageUrl, setImageUrl]   = useState(null)
  const [config, setConfig]       = useState(DEFAULT_CONFIG)
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [savingCfg, setSavingCfg] = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(null)
  const inputRef = useRef(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    const [{ data: imgData }, { data: cfgData }] = await Promise.all([
      fetchSetting(SETTING_KEY),
      fetchSetting(CONFIG_KEY),
    ])
    setImageUrl(imgData?.url ?? null)
    if (cfgData) setConfig({ ...DEFAULT_CONFIG, ...cfgData })
    setLoading(false)
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  const clearMessages = () => { setError(null); setSuccess(null) }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    clearMessages()

    const validationError = validateImageFile(file)
    if (validationError) { setError(validationError); return }

    setUploading(true)
    const { url: newUrl, error: uploadErr } = await uploadProductImage(file)
    if (uploadErr) { setError(uploadErr); setUploading(false); return }

    if (imageUrl) {
      const oldPath = extractPathFromPublicUrl(imageUrl)
      if (oldPath) deleteProductImage(oldPath).catch(() => {})
    }

    setSaving(true)
    const { error: saveErr } = await updateSetting(SETTING_KEY, { url: newUrl })
    setSaving(false)
    setUploading(false)

    if (saveErr) { setError('Imagen subida pero no se pudo guardar. Inténtalo de nuevo.'); return }
    setImageUrl(newUrl)
    setSuccess('Imagen del Hero actualizada.')
  }

  const handleRestore = async () => {
    clearMessages()
    setSaving(true)
    if (imageUrl) {
      const path = extractPathFromPublicUrl(imageUrl)
      if (path) deleteProductImage(path).catch(() => {})
    }
    const { error: saveErr } = await updateSetting(SETTING_KEY, { url: null })
    setSaving(false)
    if (saveErr) { setError('No se pudo restaurar el placeholder.'); return }
    setImageUrl(null)
    setSuccess('Hero restaurado al placeholder por defecto.')
  }

  const handleSaveConfig = async () => {
    clearMessages()
    setSavingCfg(true)
    const { error: err } = await updateSetting(CONFIG_KEY, config)
    setSavingCfg(false)
    if (err) { setError('No se pudo guardar la configuración.'); return }
    setSuccess('Ajustes de visualización guardados.')
  }

  const displayUrl = imageUrl || HERO_PLACEHOLDER
  const heightValue = parseInt(config.maxHeight) || 78

  if (loading) return (
    <div className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.85rem', padding: '2rem 0' }}>
      Cargando configuración…
    </div>
  )

  return (
    <div className="flex flex-col" style={{ gap: '2.5rem', maxWidth: '48rem' }}>

      {/* Header */}
      <div>
        <span className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.25em' }}>
          Configuración
        </span>
        <h1
          className="font-serif text-[var(--color-ink)]"
          style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1, marginTop: '0.5rem' }}
        >
          Imagen del Hero
        </h1>
        <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.85rem', marginTop: '0.75rem', lineHeight: 1.5 }}>
          Esta imagen aparece en la sección principal de la página de inicio.
        </p>
      </div>

      {/* Messages */}
      {error   && <p className="font-sans text-red-600"   style={{ fontSize: '0.85rem' }}>{error}</p>}
      {success && <p className="font-sans text-green-700" style={{ fontSize: '0.85rem' }}>{success}</p>}

      {/* Image preview — uses current config values */}
      <div className="flex flex-col" style={{ gap: '1rem' }}>
        <span className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.25em' }}>
          {imageUrl ? 'Vista previa' : 'Placeholder por defecto'}
        </span>
        <div
          className="relative overflow-hidden bg-[var(--color-surface)]"
          style={{ aspectRatio: config.aspectRatio, maxHeight: '28rem' }}
        >
          <img
            src={displayUrl}
            alt="Hero preview"
            className="h-full w-full"
            style={{ objectFit: config.objectFit }}
          />
          {!imageUrl && (
            <span
              className="absolute top-3 left-3 bg-[var(--color-ink)] font-sans text-[var(--color-paper)]"
              style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', padding: '0.3rem 0.55rem' }}
            >
              Placeholder
            </span>
          )}
        </div>
      </div>

      {/* Image actions */}
      <div className="flex flex-wrap items-center" style={{ gap: '0.75rem' }}>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || saving}
          className="bg-[var(--color-ink)] font-sans text-[var(--color-paper)] transition-opacity hover:opacity-85 disabled:opacity-50"
          style={{ padding: '0.95rem 1.5rem', fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase' }}
        >
          {uploading ? 'Subiendo…' : 'Cambiar imagen'}
        </button>
        {imageUrl && (
          <button
            type="button"
            onClick={handleRestore}
            disabled={uploading || saving}
            className="font-sans text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)] disabled:opacity-50"
            style={{ padding: '0.95rem 1.5rem', fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase', border: '1px solid var(--color-surface)' }}
          >
            Restaurar placeholder
          </button>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--color-surface)' }} />

      {/* Display config */}
      <div className="flex flex-col" style={{ gap: '1.75rem' }}>
        <div>
          <span className="label-xs" style={{ color: 'var(--color-accent)', letterSpacing: '0.3em' }}>
            Visualización
          </span>
          <h2
            className="font-serif text-[var(--color-ink)]"
            style={{ fontSize: '1.5rem', fontWeight: 300, letterSpacing: '-0.01em', marginTop: '0.25rem' }}
          >
            Ajuste de imagen
          </h2>
          <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.82rem', marginTop: '0.4rem', lineHeight: 1.5 }}>
            Los cambios se ven en tiempo real en la vista previa. Pulsa guardar para aplicarlos en la web.
          </p>
        </div>

        {/* Altura máxima */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="label-xs" style={{ color: 'var(--color-muted)', letterSpacing: '0.2em' }}>
              Altura máxima
            </span>
            <span
              className="font-sans"
              style={{ fontSize: '0.85rem', color: 'var(--color-ink)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
            >
              {heightValue}vh
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={heightValue}
            onChange={(e) => setConfig((c) => ({ ...c, maxHeight: `${e.target.value}vh` }))}
            style={{ width: '100%', accentColor: 'var(--color-accent)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="label-xs" style={{ color: 'var(--color-muted-soft)' }}>50vh</span>
            <span className="label-xs" style={{ color: 'var(--color-muted-soft)' }}>100vh</span>
          </div>
        </div>

        {/* Proporción */}
        <RadioGroup
          label="Proporción de imagen"
          options={RATIOS}
          value={config.aspectRatio}
          onChange={(v) => setConfig((c) => ({ ...c, aspectRatio: v }))}
        />

        {/* Ajuste */}
        <RadioGroup
          label="Ajuste de imagen"
          options={[
            { value: 'cover',   label: 'Cover — llena el espacio' },
            { value: 'contain', label: 'Contain — se ve completa' },
          ]}
          value={config.objectFit}
          onChange={(v) => setConfig((c) => ({ ...c, objectFit: v }))}
        />

        {/* Save config */}
        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={savingCfg}
          className="bg-[var(--color-ink)] font-sans text-[var(--color-paper)] transition-opacity hover:opacity-85 disabled:opacity-50"
          style={{
            padding: '0.9rem 2.5rem',
            fontSize: '0.72rem',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            alignSelf: 'flex-start',
          }}
        >
          {savingCfg ? 'Guardando…' : 'Guardar ajustes'}
        </button>
      </div>

      {/* Info */}
      <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.72rem', lineHeight: 1.6 }}>
        Formato recomendado: JPG o WEBP, mínimo 1400px de ancho. Máx 5 MB.
      </p>
    </div>
  )
}

export default HeroSettings
