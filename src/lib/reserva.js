// Single source of truth with the server: the field rules are the same
// functions crear-pedido-recogida uses to validate the request.
import {
  normalizarNombre,
  normalizarTelefono,
  normalizarEmail,
  normalizarNotas,
} from '../../supabase/functions/crear-pedido-recogida/validacion.ts'

const STORAGE_KEY = 'mmj-ultima-reserva'

export const validarFormulario = ({ nombre, telefono, email, notas }) => {
  const errores = {}

  const nombreOk = normalizarNombre(nombre)
  if (!nombreOk) errores.nombre = 'Escribe tu nombre (entre 2 y 80 caracteres).'

  const telefonoOk = normalizarTelefono(telefono)
  if (!telefonoOk) errores.telefono = 'Introduce un teléfono válido, por ejemplo 612 345 678.'

  const emailOk = normalizarEmail(email)
  if (!emailOk.ok) errores.email = 'El email no parece válido.'

  const notasOk = normalizarNotas(notas)
  if (!notasOk.ok) errores.notas = 'Las notas pueden tener como máximo 300 caracteres.'

  return {
    ok: Object.keys(errores).length === 0,
    errores,
    valores: { nombre: nombreOk, telefono: telefonoOk, email: emailOk.valor, notas: notasOk.valor },
  }
}

// Only what the customer chose goes to the server; prices, totals and stock
// are always resolved there.
export const construirPayload = ({ items, form, requestId, abiertoEn, ahora }) => ({
  items: items.map((i) => ({ id: i.id, colorId: i.colorId ?? null, talla: i.talla, cantidad: i.cantidad })),
  nombre: form.nombre,
  telefono: form.telefono,
  email: form.email ?? '',
  notas: form.notas ?? '',
  request_id: requestId,
  empresa: form.empresa ?? '',
  elapsed_ms: ahora - abiertoEn,
})

export const guardarUltimaReserva = (pedido) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pedido))
  } catch {
    // storage unavailable (private mode): the confirmation just won't survive a reload
  }
}

export const leerUltimaReserva = () => {
  try {
    const pedido = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
    return pedido?.numero_ticket ? pedido : null
  } catch {
    return null
  }
}
