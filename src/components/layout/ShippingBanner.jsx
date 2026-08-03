import { useState, useEffect } from 'react'
import { fetchSetting } from '@/services/settings'

export const ShippingBanner = () => {
  const [umbral, setUmbral] = useState(50)

  useEffect(() => {
    fetchSetting('envio_gratis_umbral').then(({ data }) => {
      if (data != null) setUmbral(data)
    })
  }, [])

  const MESSAGES = [
    `Envío gratis a partir de ${umbral}€`,
    'Envíos a toda España — consulta tu zona por WhatsApp',
    'Recogida presencial en Sevilla · Parque Alcosa',
  ]

  const TRACK = [...MESSAGES, ...MESSAGES, ...MESSAGES, ...MESSAGES]

  return (
  <div
    className="fixed inset-x-0 top-0 z-[60] h-9 overflow-hidden flex items-center"
    style={{ backgroundColor: 'var(--color-ink)' }}
    aria-label="Información de envío"
  >
    <div className="shipping-ticker flex items-center whitespace-nowrap will-change-transform">
      {TRACK.map((msg, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-3 px-10"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.65rem',
            fontWeight: 500,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-base)',
          }}
        >
          <span style={{ color: 'var(--color-accent)', fontSize: '0.5rem' }}>✦</span>
          {msg}
        </span>
      ))}
    </div>
  </div>
  )
}
