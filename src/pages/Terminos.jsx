import { Link } from 'react-router-dom'

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

const Pill = ({ children, ok }) => (
  <span
    className="inline-block font-sans"
    style={{
      fontSize: '0.75rem',
      letterSpacing: '0.1em',
      padding: '0.2rem 0.6rem',
      border: `1px solid ${ok ? 'var(--color-ink)' : 'var(--color-surface)'}`,
      color: ok ? 'var(--color-ink)' : 'var(--color-muted)',
      marginRight: '0.4rem',
    }}
  >
    {children}
  </span>
)

const Terminos = () => (
  <div
    className="bg-[var(--color-base)] px-6 md:px-10"
    style={{ paddingTop: '8rem', paddingBottom: '6rem', maxWidth: '780px', margin: '0 auto' }}
  >
    {/* Header */}
    <div style={{ marginBottom: '3rem' }}>
      <span className="label-xs text-[var(--color-muted)]" style={{ letterSpacing: '0.25em' }}>
        Legal
      </span>
      <h1
        className="font-serif font-light text-[var(--color-ink)]"
        style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', marginTop: '0.5rem', letterSpacing: '-0.02em', lineHeight: 1.1 }}
      >
        Términos, Condiciones<br />y Devoluciones
      </h1>
      <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.82rem', marginTop: '0.75rem' }}>
        Última actualización: abril 2026
      </p>
    </div>

    <Section num="01" title="Quiénes somos">
      <p>
        <strong className="text-[var(--color-ink)]">Stylo019</strong><br />
        CIF: 28753199W<br />
        Av. Ildefonso Marañón Lavín, 9 — 41019 Sevilla, España<br />
        Email:{' '}
        <a href="mailto:modastylo019@gmail.com" className="text-[var(--color-ink)] underline underline-offset-4">
          modastylo019@gmail.com
        </a><br />
        WhatsApp: 658 509 332
      </p>
    </Section>

    <Section num="02" title="Proceso de compra">
      <p className="mb-3">El proceso de compra en Stylo019 es el siguiente:</p>
      <ol className="list-decimal pl-5 space-y-2 mb-4">
        <li>Explora el catálogo y selecciona el producto y la talla que deseas.</li>
        <li>Añade el artículo al carrito y procede al pago.</li>
        <li>El pago se realiza de forma segura a través de <strong className="text-[var(--color-ink)]">Stripe</strong>, con tarjeta de crédito o débito.</li>
        <li>Una vez completado el pago, recibirás un <strong className="text-[var(--color-ink)]">recibo automático en tu email</strong> con el detalle del pedido.</li>
        <li>Nos pondremos en contacto contigo por <strong className="text-[var(--color-ink)]">WhatsApp o email</strong> para confirmar el envío y los detalles de entrega.</li>
      </ol>
      <p>
        Los precios incluyen IVA y están expresados en euros (€). El cargo se realiza en el momento
        del pago. Stylo019 se reserva el derecho de cancelar un pedido si el artículo no está
        disponible en stock, en cuyo caso se realizará el reembolso completo de forma inmediata.
      </p>
    </Section>

    <Section num="03" title="Devoluciones y desistimiento">
      {/* Visual highlight */}
      <div
        className="border border-[var(--color-ink)] p-5 mb-6"
        style={{ background: 'var(--color-paper)' }}
      >
        <p className="font-serif font-light text-[var(--color-ink)] mb-1" style={{ fontSize: '1.1rem' }}>
          En Stylo019 ampliamos el plazo legal a{' '}
          <strong>30 días naturales</strong> desde la recepción.
        </p>
        <p className="font-sans text-[var(--color-muted)]" style={{ fontSize: '0.82rem' }}>
          La ley española exige 14 días (Art. 102 LGDCU). Nosotras damos el doble.
        </p>
      </div>

      <p className="mb-4 font-sans font-light text-[var(--color-muted)]">
        Puedes devolver cualquier artículo sin necesidad de justificación dentro de ese plazo,
        siempre que cumpla las condiciones siguientes:
      </p>

      <div className="flex flex-wrap gap-2 mb-5">
        <Pill ok>Sin usar</Pill>
        <Pill ok>Etiquetas puestas</Pill>
        <Pill ok>Embalaje original</Pill>
        <Pill ok>Sin perfume ni manchas</Pill>
      </div>

      <p className="mb-3 font-sans font-semibold text-[var(--color-ink)]" style={{ fontSize: '0.88rem' }}>
        ¿Cómo solicitar una devolución?
      </p>
      <ol className="list-decimal pl-5 space-y-2 mb-4">
        <li>
          Escríbenos por{' '}
          <a
            href="https://wa.me/34658509332"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-ink)] underline underline-offset-4"
          >
            WhatsApp
          </a>{' '}
          o a modastylo019@gmail.com indicando el artículo y el motivo.
        </li>
        <li>Te confirmamos el proceso y la dirección de envío.</li>
        <li>Envías el artículo — <strong className="text-[var(--color-ink)]">los gastos de devolución corren a cargo del cliente</strong>, salvo defecto de fabricación.</li>
        <li>Una vez recibido y verificado, procesamos el reembolso en un máximo de <strong className="text-[var(--color-ink)]">14 días</strong> (Art. 106 LGDCU).</li>
      </ol>
    </Section>

    <Section num="04" title="Excepciones — sin derecho a devolución">
      <p className="mb-3">No se admiten devoluciones en los siguientes casos:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Ropa interior, bañadores o bikinis que hayan sido probados sin ropa interior debajo.</li>
        <li>Artículos personalizados o con modificaciones a medida solicitadas por el cliente.</li>
        <li>Artículos en liquidación o promoción especial (salvo defecto de fabricación).</li>
        <li>Artículos devueltos en mal estado, usados, sin etiquetas o sin embalaje original.</li>
      </ul>
    </Section>

    <Section num="05" title="Garantía del producto">
      <p>
        Todos nuestros productos tienen <strong className="text-[var(--color-ink)]">3 años de garantía legal</strong> por
        defectos de fabricación (Art. 120 LGDCU, actualizado 2024). Si recibes un artículo
        defectuoso, contáctanos y gestionamos la reparación, sustitución o reembolso completo
        sin coste para ti.
      </p>
    </Section>

    <Section num="06" title="Envíos">
      <p>
        Realizamos envíos a España peninsular, Baleares y Canarias. Los gastos de envío y el
        plazo de entrega se acuerdan con cada cliente por WhatsApp antes de confirmar el pedido.
        No nos hacemos responsables de retrasos de la empresa de transporte una vez entregado el paquete.
      </p>
    </Section>

    <Section num="07" title="Protección de datos">
      <p>
        El tratamiento de tus datos personales se rige por nuestra{' '}
        <Link to="/privacidad" className="text-[var(--color-ink)] underline underline-offset-4 hover:text-[var(--color-accent)] transition-colors">
          Política de Privacidad
        </Link>.
      </p>
    </Section>

    <Section num="08" title="Legislación y fuero">
      <p>
        Estos términos se rigen por la legislación española, en particular el Real Decreto Legislativo
        1/2007 (LGDCU) y sus modificaciones. Para cualquier controversia, las partes se someten
        a los Juzgados y Tribunales de Sevilla.
      </p>
    </Section>
  </div>
)

export default Terminos
