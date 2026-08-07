// Printable receipt for a TPV sale, via window.print(). Not a legal
// invoice — Odoo issues that (see supabase/functions/odoo-sync) once
// activated. This is the courtesy ticket handed to the customer at the
// counter, sized for an 80mm thermal printer but readable on plain paper
// too if the shop prints on a regular printer instead.

const PAGO_LABEL = { efectivo: 'Efectivo', tarjeta: 'Tarjeta' }

const formatDateTime = (d) =>
  d.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

export const TicketVenta = ({ venta, onNuevaVenta }) => (
  <div className="flex flex-col items-center" style={{ gap: '1.5rem' }}>
    <style>{`
      @media print {
        body * { visibility: hidden; }
        #ticket-venta, #ticket-venta * { visibility: visible; }
        #ticket-venta { position: absolute; top: 0; left: 0; width: 80mm; }
        .ticket-no-print { display: none !important; }
      }
    `}</style>

    <div className="ticket-no-print flex items-center" style={{ gap: '0.75rem' }}>
      <button
        type="button"
        onClick={() => window.print()}
        className="bg-[var(--color-ink)] font-sans text-[var(--color-paper)] transition-opacity hover:opacity-85"
        style={{ fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase', padding: '0.95rem 1.75rem' }}
      >
        Imprimir ticket
      </button>
      <button
        type="button"
        onClick={onNuevaVenta}
        className="font-sans text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        style={{ fontSize: '0.72rem', letterSpacing: '0.25em', textTransform: 'uppercase', padding: '0.95rem 1.25rem', border: '1px solid var(--color-surface)' }}
      >
        Nueva venta
      </button>
    </div>

    <div
      id="ticket-venta"
      className="bg-[var(--color-paper)] font-sans text-[var(--color-ink)]"
      style={{ width: '320px', padding: '1.5rem', border: '1px solid var(--color-surface)', fontSize: '0.8rem', lineHeight: 1.5 }}
    >
      <p className="font-serif" style={{ fontSize: '1.15rem', fontWeight: 400, textAlign: 'center' }}>Stylo019</p>
      <p style={{ textAlign: 'center', color: 'var(--color-muted)' }}>ModaMariaJose</p>
      <p style={{ textAlign: 'center', color: 'var(--color-muted)' }}>CIF: 28753199W</p>
      <p style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Calle Ciudad de Carlet, 10, Local 2</p>
      <p style={{ textAlign: 'center', color: 'var(--color-muted)', marginBottom: '0.75rem' }}>41019 Sevilla</p>

      <div style={{ borderTop: '1px dashed var(--color-surface)', margin: '0.75rem 0' }} />

      <p>Ticket #{String(venta.numeroTicket).padStart(6, '0')}</p>
      <p style={{ color: 'var(--color-muted)' }}>{formatDateTime(venta.createdAt)}</p>

      <div style={{ borderTop: '1px dashed var(--color-surface)', margin: '0.75rem 0' }} />

      {venta.items.map((l) => (
        <div key={l.key} style={{ marginBottom: '0.5rem' }}>
          <div className="flex items-center justify-between">
            <span>{l.cantidad} × {l.productoNombre}</span>
            <span>{(l.precioUnitario * l.cantidad).toFixed(2)} €</span>
          </div>
          {(l.colorLabel || l.talla) && (
            <span style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>
              {[l.colorLabel, `Talla ${l.talla}`].filter(Boolean).join(' — ')}
            </span>
          )}
          {l.precioOriginal != null && l.precioUnitario !== l.precioOriginal && (
            <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>
              Descuento aplicado (antes {l.precioOriginal.toFixed(2)} € / u)
            </div>
          )}
        </div>
      ))}

      <div style={{ borderTop: '1px dashed var(--color-surface)', margin: '0.75rem 0' }} />

      <div className="flex items-center justify-between" style={{ fontSize: '1rem', fontWeight: 600 }}>
        <span>TOTAL</span>
        <span>{Number(venta.total).toFixed(2)} €</span>
      </div>
      <p style={{ color: 'var(--color-muted)', marginTop: '0.35rem' }}>
        Pago: {PAGO_LABEL[venta.metodoPago] ?? venta.metodoPago}
      </p>

      <div style={{ borderTop: '1px dashed var(--color-surface)', margin: '0.75rem 0' }} />

      <p style={{ textAlign: 'center' }}>Gracias por tu compra</p>
      <p style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.68rem' }}>
        Este comprobante no es una factura oficial.
      </p>
    </div>
  </div>
)
