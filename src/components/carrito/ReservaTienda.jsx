import { useRef, useState } from 'react'
import { useCartStore } from '@/store/useCartStore'
import { getPrecioEfectivo } from '@/lib/precio'
import { crearPedidoRecogida } from '@/services/pedidos'
import { validarFormulario, construirPayload, guardarUltimaReserva } from '@/lib/reserva'
import { comprobanteLineas, compartirComprobante, descargarComprobante } from '@/lib/comprobante'

// The server rejects forms sent in under 2.5 s (anti-bot). A fast autofill can
// beat that, so wait out the difference instead of failing a real customer.
const MIN_ESPERA_MS = 2800

const CAMPO =
  'bg-transparent border-b outline-none py-3 font-serif font-light text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] transition-colors'

const Campo = ({ id, etiqueta, obligatorio, error, children }) => (
  <div className="flex flex-col gap-2">
    <label htmlFor={id} className="label-xs text-[var(--color-muted)]">
      {etiqueta}{' '}
      {obligatorio ? (
        <span className="text-[var(--color-accent-ink)]" aria-hidden="true">*</span>
      ) : (
        <span className="text-[var(--color-muted-soft)]">(opcional)</span>
      )}
    </label>
    {children}
    {error && (
      <p id={`${id}-error`} role="alert" className="label-xs text-[var(--color-accent-ink)]">
        {error}
      </p>
    )}
  </div>
)

const claseBorde = (error) =>
  error
    ? 'border-[var(--color-accent)]'
    : 'border-[var(--color-surface)] focus:border-[var(--color-accent)]'

const BOTON_PRIMARIO = {
  background: 'var(--color-ink)',
  color: 'var(--color-paper)',
  letterSpacing: '0.12em',
}
const BOTON_SECUNDARIO = {
  border: '1px solid var(--color-ink)',
  color: 'var(--color-ink)',
  letterSpacing: '0.12em',
}
const BOTON = 'w-full py-4 text-center font-sans text-sm uppercase transition-opacity duration-200 disabled:opacity-60'

const Confirmacion = ({ pedido, onCerrar }) => {
  const [aviso, setAviso] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const ejecutar = async (accion, mensajes) => {
    setOcupado(true)
    setAviso(null)
    try {
      const resultado = await accion()
      if (mensajes[resultado]) setAviso({ tipo: 'status', texto: mensajes[resultado] })
    } catch {
      setAviso({
        tipo: 'alert',
        texto: 'No se pudo generar el comprobante. Tu reserva está guardada: escríbenos por WhatsApp y te ayudamos.',
      })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
      <section aria-label="Resumen de la reserva" className="flex flex-col gap-3">
        {comprobanteLineas(pedido).map((linea, i) => {
          if (linea.tipo === 'sep') {
            return <hr key={i} style={{ borderColor: 'var(--color-surface)' }} />
          }
          if (linea.tipo === 'titulo') {
            return (
              <h3 key={i} className="font-serif" style={{ fontSize: '1.7rem', color: 'var(--color-ink)' }}>
                {linea.texto}
              </h3>
            )
          }
          if (linea.tipo === 'item' || linea.tipo === 'total') {
            return (
              <div key={i} className="flex justify-between gap-4">
                <p
                  className={linea.tipo === 'total' ? 'font-serif font-semibold' : 'font-serif'}
                  style={{ color: 'var(--color-ink)' }}
                >
                  {linea.texto}
                  {linea.detalle && (
                    <span className="block label-xs" style={{ color: 'var(--color-muted)' }}>
                      {linea.detalle}
                    </span>
                  )}
                </p>
                <p className="font-serif tabular-nums" style={{ color: 'var(--color-ink)' }}>
                  {linea.importe}
                </p>
              </div>
            )
          }
          return (
            <p
              key={i}
              className="label-xs"
              style={{
                color: linea.tipo === 'aviso' ? 'var(--color-ink)' : 'var(--color-muted)',
                fontWeight: linea.tipo === 'aviso' ? 600 : 400,
                textTransform: 'none',
                letterSpacing: '0.02em',
                fontSize: '0.8rem',
              }}
            >
              {linea.texto}
            </p>
          )
        })}
      </section>

      <p className="label-xs" style={{ color: 'var(--color-muted)', textTransform: 'none', letterSpacing: '0.02em' }}>
        Tu reserva ya está guardada. Envía el comprobante por WhatsApp para que la tienda te confirme y puedas
        recogerla.
      </p>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            ejecutar(() => compartirComprobante(pedido), {
              compartido: 'Comprobante compartido.',
              descargado: 'Comprobante descargado: adjúntalo en el chat de WhatsApp que se ha abierto.',
            })
          }
          className={BOTON}
          style={{ ...BOTON_PRIMARIO, background: 'var(--color-accent-ink)' }}
        >
          Enviar comprobante por WhatsApp
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => ejecutar(() => descargarComprobante(pedido), { undefined: 'Comprobante descargado.' })}
          className={BOTON}
          style={BOTON_SECUNDARIO}
        >
          Descargar comprobante
        </button>
        {aviso && (
          <p
            role={aviso.tipo}
            className="label-xs"
            style={{ color: aviso.tipo === 'alert' ? 'var(--color-accent-ink)' : 'var(--color-muted)', textTransform: 'none' }}
          >
            {aviso.texto}
          </p>
        )}
        <button
          type="button"
          onClick={onCerrar}
          className="label-xs self-center transition-colors duration-200"
          style={{ color: 'var(--color-muted)' }}
        >
          Seguir comprando
        </button>
      </div>
    </div>
  )
}

// "Recogida y pago en tienda": saves the order (stock reserved 7 days) with no
// online payment and hands the customer a receipt to send by WhatsApp.
export const ReservaTienda = ({ pedidoInicial = null, onVolver, onCerrar }) => {
  const items = useCartStore((s) => s.items)
  const total = useCartStore((s) => s.total)
  const clearCart = useCartStore((s) => s.clearCart)

  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', notas: '', empresa: '' })
  const [errores, setErrores] = useState({})
  const [estado, setEstado] = useState('idle')
  const [errorServidor, setErrorServidor] = useState(null)
  const [pedido, setPedido] = useState(pedidoInicial)

  const abiertoEn = useRef(null)
  if (abiertoEn.current === null) abiertoEn.current = Date.now()
  const requestId = useRef(null)
  if (requestId.current === null) requestId.current = crypto.randomUUID()
  const enviando = useRef(false)

  const cambiar = (campo) => (e) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }))
    if (errores[campo]) setErrores((er) => ({ ...er, [campo]: undefined }))
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (enviando.current) return

    const { ok, errores: nuevos } = validarFormulario(form)
    setErrores(nuevos)
    if (!ok) return

    enviando.current = true
    setEstado('enviando')
    setErrorServidor(null)
    try {
      const falta = MIN_ESPERA_MS - (Date.now() - abiertoEn.current)
      if (falta > 0) await new Promise((r) => setTimeout(r, falta))

      const reserva = await crearPedidoRecogida(
        construirPayload({ items, form, requestId: requestId.current, abiertoEn: abiertoEn.current, ahora: Date.now() }),
      )
      clearCart()
      guardarUltimaReserva(reserva)
      setPedido(reserva)
      setEstado('ok')
    } catch (err) {
      setErrorServidor(err.message)
      setEstado('error')
    } finally {
      enviando.current = false
    }
  }

  const sending = estado === 'enviando'

  return (
    <>
      <header
        className="flex items-center justify-between px-6 pt-12 pb-5 border-b"
        style={{ borderColor: 'var(--color-surface)' }}
      >
        <span className="font-serif font-light" style={{ fontSize: '1.4rem', color: 'var(--color-ink)' }}>
          {pedido ? 'Reserva confirmada' : 'Reservar y pagar en tienda'}
        </span>
        <button
          type="button"
          onClick={pedido ? onCerrar : onVolver}
          className="label-xs transition-colors duration-200"
          style={{ color: 'var(--color-muted)' }}
        >
          {pedido ? 'Cerrar' : '← Volver'}
        </button>
      </header>

      {pedido ? (
        <Confirmacion pedido={pedido} onCerrar={onCerrar} />
      ) : (
        <form onSubmit={enviar} noValidate className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
          <p className="label-xs" style={{ color: 'var(--color-muted)', textTransform: 'none', letterSpacing: '0.02em' }}>
            Reservamos tus prendas durante 7 días. No pagas ahora: recogida y pago en tienda.
          </p>

          <ul className="flex flex-col gap-2" aria-label="Tu selección">
            {items.map((item) => {
              const precio = item.precioUnitario ?? getPrecioEfectivo(item, item.talla)
              return (
                <li
                  key={`${item.id}-${item.talla}-${item.colorId ?? 'base'}`}
                  className="flex justify-between gap-4 font-serif"
                  style={{ color: 'var(--color-ink)' }}
                >
                  <span>
                    {item.nombre}
                    {item.colorLabel ? ` (${item.colorLabel})` : ''}
                    <span className="block label-xs" style={{ color: 'var(--color-muted)' }}>
                      Talla {item.talla} × {item.cantidad}
                    </span>
                  </span>
                  <span className="tabular-nums">€{(precio * item.cantidad).toFixed(2)}</span>
                </li>
              )
            })}
            <li className="flex justify-between font-serif font-semibold pt-2" style={{ color: 'var(--color-ink)' }}>
              <span>Total a pagar en tienda</span>
              <span className="tabular-nums">€{total().toFixed(2)}</span>
            </li>
          </ul>

          <Campo id="reserva-nombre" etiqueta="Nombre" obligatorio error={errores.nombre}>
            <input
              id="reserva-nombre"
              name="nombre"
              type="text"
              required
              maxLength={80}
              autoComplete="name"
              value={form.nombre}
              onChange={cambiar('nombre')}
              aria-invalid={Boolean(errores.nombre)}
              aria-describedby={errores.nombre ? 'reserva-nombre-error' : undefined}
              className={`${CAMPO} ${claseBorde(errores.nombre)}`}
              style={{ fontSize: '1.15rem' }}
            />
          </Campo>

          <Campo id="reserva-telefono" etiqueta="Teléfono" obligatorio error={errores.telefono}>
            <input
              id="reserva-telefono"
              name="telefono"
              type="tel"
              inputMode="tel"
              required
              maxLength={20}
              autoComplete="tel"
              placeholder="612 345 678"
              value={form.telefono}
              onChange={cambiar('telefono')}
              aria-invalid={Boolean(errores.telefono)}
              aria-describedby={errores.telefono ? 'reserva-telefono-error' : undefined}
              className={`${CAMPO} ${claseBorde(errores.telefono)}`}
              style={{ fontSize: '1.15rem' }}
            />
          </Campo>

          <Campo id="reserva-email" etiqueta="Email" error={errores.email}>
            <input
              id="reserva-email"
              name="email"
              type="email"
              inputMode="email"
              maxLength={120}
              autoComplete="email"
              value={form.email}
              onChange={cambiar('email')}
              aria-invalid={Boolean(errores.email)}
              aria-describedby={errores.email ? 'reserva-email-error' : undefined}
              className={`${CAMPO} ${claseBorde(errores.email)}`}
              style={{ fontSize: '1.15rem' }}
            />
          </Campo>

          <Campo id="reserva-notas" etiqueta="Notas" error={errores.notas}>
            <textarea
              id="reserva-notas"
              name="notas"
              rows={2}
              maxLength={300}
              value={form.notas}
              onChange={cambiar('notas')}
              aria-invalid={Boolean(errores.notas)}
              aria-describedby={errores.notas ? 'reserva-notas-error' : undefined}
              className={`${CAMPO} ${claseBorde(errores.notas)} resize-none`}
              style={{ fontSize: '1.15rem' }}
            />
          </Campo>

          {/* Honeypot: invisible to people and assistive tech, bots fill it in. */}
          <div
            aria-hidden="true"
            style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}
          >
            <label>
              Empresa
              <input
                type="text"
                name="empresa"
                tabIndex={-1}
                autoComplete="off"
                value={form.empresa}
                onChange={cambiar('empresa')}
              />
            </label>
          </div>

          {errorServidor && (
            <p role="alert" className="label-xs" style={{ color: 'var(--color-accent-ink)', textTransform: 'none' }}>
              {errorServidor}
            </p>
          )}

          <button type="submit" disabled={sending} className={BOTON} style={BOTON_PRIMARIO}>
            {sending ? 'Enviando…' : 'Confirmar reserva'}
          </button>
        </form>
      )}
    </>
  )
}
