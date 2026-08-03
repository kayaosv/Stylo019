const Section = ({ num, title, children }) => (
  <div style={{ marginBottom: '2.5rem' }}>
    <div className="flex items-baseline gap-3 mb-4 pb-3 border-b border-[var(--color-surface)]">
      <span className="label-xs text-[var(--color-accent-ink)]">[{num}]</span>
      <h2 className="font-serif font-light text-[var(--color-ink)]" style={{ fontSize: '1.3rem' }}>
        {title}
      </h2>
    </div>
    <div className="font-sans font-light text-[var(--color-muted)]" style={{ fontSize: '0.92rem', lineHeight: 1.75 }}>
      {children}
    </div>
  </div>
)

const Privacidad = () => (
  <div
    className="bg-[var(--color-base)] px-6 md:px-10"
    style={{ paddingTop: '8rem', paddingBottom: '6rem', maxWidth: '780px', margin: '0 auto' }}
  >
    <div style={{ marginBottom: '3rem' }}>
      <span className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.25em' }}>
        Legal
      </span>
      <h1
        className="font-serif font-light text-[var(--color-ink)]"
        style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', marginTop: '0.5rem', letterSpacing: '-0.02em' }}
      >
        Política de Privacidad
      </h1>
      <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.82rem', marginTop: '0.75rem' }}>
        Última actualización: abril 2026
      </p>
    </div>

    <Section num="01" title="Responsable del tratamiento">
      <p>
        <strong className="text-[var(--color-ink)]">Stylo019</strong><br />
        CIF: 28753199W<br />
        Calle Ciudad de Carlet, 10, Local 2 — 41019 Sevilla, España<br />
        Email: modastylo019@gmail.com<br />
        WhatsApp: 658 509 332
      </p>
    </Section>

    <Section num="02" title="Datos que recopilamos">
      <p className="mb-3">Recopilamos únicamente los datos que tú nos proporcionas voluntariamente:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong className="text-[var(--color-ink)]">Email y nombre</strong> — cuando te suscribes a nuestra newsletter.</li>
        <li><strong className="text-[var(--color-ink)]">Datos de contacto</strong> — cuando nos escribes por WhatsApp o email para consultar sobre un producto.</li>
      </ul>
      <p className="mt-3">No recopilamos datos de tarjetas de crédito ni información bancaria a través de esta web.</p>
    </Section>

    <Section num="03" title="Finalidad del tratamiento">
      <ul className="list-disc pl-5 space-y-1">
        <li>Enviarte novedades y comunicaciones sobre nuevas piezas (newsletter), si te has suscrito.</li>
        <li>Gestionar consultas sobre productos y disponibilidad de stock.</li>
        <li>Cumplir con obligaciones legales aplicables.</li>
      </ul>
    </Section>

    <Section num="04" title="Base legal">
      <ul className="list-disc pl-5 space-y-1">
        <li><strong className="text-[var(--color-ink)]">Consentimiento</strong> — para el envío de newsletter. Puedes retirar tu consentimiento en cualquier momento.</li>
        <li><strong className="text-[var(--color-ink)]">Interés legítimo</strong> — para responder a consultas comerciales iniciadas por ti.</li>
      </ul>
    </Section>

    <Section num="05" title="Conservación de datos">
      <p>
        Conservamos tus datos mientras seas suscriptor activo o mientras exista relación comercial contigo.
        Puedes solicitar la eliminación de tus datos en cualquier momento escribiéndonos a modastylo019@gmail.com.
      </p>
    </Section>

    <Section num="06" title="Tus derechos (RGPD)">
      <p className="mb-3">De acuerdo con el Reglamento General de Protección de Datos (UE) 2016/679, tienes derecho a:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong className="text-[var(--color-ink)]">Acceso</strong> — conocer qué datos tenemos sobre ti.</li>
        <li><strong className="text-[var(--color-ink)]">Rectificación</strong> — corregir datos inexactos.</li>
        <li><strong className="text-[var(--color-ink)]">Supresión</strong> — solicitar que eliminemos tus datos.</li>
        <li><strong className="text-[var(--color-ink)]">Portabilidad</strong> — recibir tus datos en formato estructurado.</li>
        <li><strong className="text-[var(--color-ink)]">Oposición</strong> — oponerte al tratamiento de tus datos.</li>
      </ul>
      <p className="mt-3">
        Para ejercer cualquiera de estos derechos, escríbenos a{' '}
        <a href="mailto:modastylo019@gmail.com" className="text-[var(--color-ink)] underline underline-offset-4">
          modastylo019@gmail.com
        </a>.
        También puedes reclamar ante la{' '}
        <strong className="text-[var(--color-ink)]">Agencia Española de Protección de Datos (AEPD)</strong> en{' '}
        <a href="https://www.aepd.es" target="_blank" rel="noreferrer" className="text-[var(--color-ink)] underline underline-offset-4">
          www.aepd.es
        </a>.
      </p>
    </Section>

    <Section num="07" title="Seguridad">
      <p>
        Aplicamos medidas técnicas y organizativas adecuadas para proteger tus datos frente a accesos no autorizados,
        pérdida o alteración. Los datos de suscripción se almacenan en servidores seguros de Supabase (UE).
      </p>
    </Section>
  </div>
)

export default Privacidad
