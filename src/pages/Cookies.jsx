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

const Cookies = () => (
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
        Política de Cookies
      </h1>
      <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.82rem', marginTop: '0.75rem' }}>
        Última actualización: abril 2026
      </p>
    </div>

    <Section num="01" title="¿Qué son las cookies?">
      <p>
        Las cookies son pequeños archivos de texto que un sitio web almacena en tu dispositivo cuando lo visitas.
        Sirven para que el sitio funcione correctamente y para recordar tus preferencias.
      </p>
    </Section>

    <Section num="02" title="Cookies que utilizamos">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" style={{ fontSize: '0.88rem' }}>
          <thead>
            <tr className="border-b border-[var(--color-surface)]">
              <th className="py-2 pr-6 font-sans font-medium text-[var(--color-ink)]">Nombre</th>
              <th className="py-2 pr-6 font-sans font-medium text-[var(--color-ink)]">Tipo</th>
              <th className="py-2 font-sans font-medium text-[var(--color-ink)]">Finalidad</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['cookie_consent', 'Funcional', 'Guarda tu preferencia sobre el aviso de cookies. Duración: 1 año.'],
              ['sb-*', 'Sesión', 'Cookies de Supabase para mantener la sesión del panel de administración.'],
              ['Google Maps (iframe)', 'Terceros', 'Al cargar el mapa en la página de contacto, Google puede establecer sus propias cookies. Consulta la política de Google.'],
            ].map(([nombre, tipo, fin]) => (
              <tr key={nombre} className="border-b border-[var(--color-surface)]">
                <td className="py-3 pr-6 font-mono text-[var(--color-ink)]" style={{ fontSize: '0.8rem' }}>{nombre}</td>
                <td className="py-3 pr-6">{tipo}</td>
                <td className="py-3">{fin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4">
        Esta web <strong className="text-[var(--color-ink)]">no utiliza cookies de analítica ni publicidad</strong>.
      </p>
    </Section>

    <Section num="03" title="Cookies de terceros">
      <p>
        El mapa de Google Maps integrado en la página de Contacto puede cargar cookies propias de Google.
        Estas cookies están sujetas a la política de privacidad de Google y quedan fuera de nuestro control.
        Si prefieres no recibirlas, puedes bloquear el iframe desde la configuración de tu navegador.
      </p>
    </Section>

    <Section num="04" title="Cómo gestionar o eliminar cookies">
      <p className="mb-3">Puedes configurar tu navegador para rechazar o eliminar cookies:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong className="text-[var(--color-ink)]">Chrome</strong> — Configuración → Privacidad y seguridad → Cookies</li>
        <li><strong className="text-[var(--color-ink)]">Firefox</strong> — Opciones → Privacidad y Seguridad</li>
        <li><strong className="text-[var(--color-ink)]">Safari</strong> — Preferencias → Privacidad</li>
        <li><strong className="text-[var(--color-ink)]">Edge</strong> — Configuración → Privacidad, búsqueda y servicios</li>
      </ul>
      <p className="mt-3">
        Ten en cuenta que deshabilitar ciertas cookies puede afectar al funcionamiento del sitio.
      </p>
    </Section>

    <Section num="05" title="Más información">
      <p>
        Para cualquier consulta sobre el uso de cookies, escríbenos a{' '}
        <a href="mailto:modastylo019@gmail.com" className="text-[var(--color-ink)] underline underline-offset-4">
          modastylo019@gmail.com
        </a>.
      </p>
    </Section>
  </div>
)

export default Cookies
