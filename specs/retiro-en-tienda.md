# Retiro en tienda (reserva sin pago online)

## Objetivo
Que una clienta pueda reservar su carrito para recogerlo y pagarlo en la tienda, sin pasarela. El pedido queda registrado en el admin como **pendiente de cobro**, con el stock reservado durante 7 días, y la clienta recibe un **comprobante descargable** que también se envía por WhatsApp (`34638970807`) para que la tienda se ponga en contacto.

## Decisiones ya tomadas (confirmadas por el usuario, 2026-10-21)
- El stock **se reserva** al crear el pedido (misma lógica que Stripe).
- La reserva dura **7 días**; pasado ese plazo se cancela y se repone el stock con el cron existente (`expirar_ventas_pendientes`, sin cambios).
- WhatsApp de la tienda: `34638970807` (el que ya usa `CartDrawer.jsx`).
- Datos de la clienta: **nombre y teléfono obligatorios; email opcional**.
- Comprobante: el resumen del pedido guardado, **descargable** y es el mismo que se envía por WhatsApp. **No** hace falta PDF.
- Se trabaja sobre el proyecto de kayao (GitHub `kayaosv/Stylo019`, Vercel y Supabase de kayao).

## Decisiones de diseño tomadas por Claude (revisar)
- **Comprobante = imagen PNG** generada en el navegador (canvas, sin dependencias nuevas). `wa.me` no puede adjuntar archivos; por eso en móvil se usa la Web Share API con el archivo (la clienta elige WhatsApp) y en escritorio se descarga el PNG y se abre `wa.me` con el mismo resumen en texto. El texto siempre incluye el número de pedido, así que la tienda tiene los datos aunque no llegue la imagen.
- **El comprobante se construye con la respuesta del servidor**, no con el carrito del navegador: lo que ve la clienta es lo que quedó guardado.
- **Estado de pago separado del estado logístico.** `ventas.estado` sigue siendo `pendiente → preparando → listo → entregado | cancelado`. El cobro se modela con `pagado_at` (vacío = sin cobrar). No se crea un estado `pendiente_pago`.
- `metodo_pago = 'recogida'` se mantiene siempre; cómo se cobró al final se guarda en `cobrado_con` (`efectivo`/`tarjeta`).
- **La puerta de entrada es una edge function**, no una llamada directa a la base de datos: igual que `crear_venta_web`, la función SQL solo la ejecuta `service_role` (comprobado en producción el 2026-10-21: `anon` y `authenticated` no pueden ejecutar `crear_venta_web`, `resolver_linea_checkout`, `expirar_ventas_pendientes`).

## Criterios de aceptación

### Clienta (carrito)
- [ ] El carrito muestra una tercera opción «Reservar y pagar en tienda», además de «Pagar con tarjeta» y «Finalizar por WhatsApp».
- [ ] Al pulsarla se abre un formulario con nombre (obligatorio), teléfono (obligatorio), email (opcional) y notas (opcional). Valida en el navegador y muestra errores claros en español.
- [ ] Si falta stock o un producto ya no está disponible, se muestra el motivo real del servidor y **no se crea** pedido.
- [ ] Al confirmar se muestra el número de pedido, el resumen, hasta qué día es válida la reserva (7 días) y el texto «Recogida y pago en tienda — pendiente de pago».
- [ ] El carrito se vacía solo cuando el servidor confirma la reserva. Si falla, el carrito se conserva.
- [ ] Doble clic o reintento no crea dos pedidos (clave de idempotencia).
- [ ] Funciona en cualquier tamaño de pantalla (regla permanente de responsive).

### Comprobante y WhatsApp
- [ ] Botón «Descargar comprobante» genera un PNG con: marca, nº de pedido, fecha, nombre y teléfono, líneas (producto, color, talla, cantidad, precio), total, «Método de pago: recogida y pago en tienda — pendiente de pago» y validez de la reserva.
- [ ] Botón «Enviar por WhatsApp»: en navegadores con soporte de archivos (móvil) comparte el PNG + texto; si no, descarga el PNG y abre `https://wa.me/34638970807?text=…` con el resumen.
- [ ] El texto de WhatsApp incluye «Pedido #N» y «Método de pago: recogida y pago en tienda».
- [ ] Todo texto del usuario que entra en la URL de WhatsApp pasa por `encodeURIComponent` y sin caracteres de control.
- [ ] La confirmación sobrevive a recargar la página (se guarda el último pedido en `sessionStorage`).

### Servidor y base de datos
- [ ] Migración `022_pedidos_recogida.sql` (en el repo, para poder reaplicarla en otro proyecto Supabase): `ventas.pagado_at`, `ventas.cobrado_con`, `ventas.idempotency_key` (único), `'recogida'` permitido en `ventas_metodo_pago_check`, tabla `pedido_rate_limits`.
- [ ] Todas las ventas existentes quedan con `pagado_at = created_at` (ya estaban cobradas). Las nuevas ventas de TPV y Stripe siguen cobradas sin modificar sus funciones (`pagado_at` con `DEFAULT now()`); la reserva inserta `NULL` explícito.
- [ ] `crear_pedido_recogida(...)` (SECURITY DEFINER, `search_path` fijo) reutiliza la lógica de precio y stock de `crear_venta_web`: precios y stock se calculan **siempre en el servidor**, con bloqueo de fila y descuento de stock en la misma transacción.
- [ ] `EXECUTE` revocado a `public`, `anon` y `authenticated`; concedido solo a `service_role`.
- [ ] Edge function `crear-pedido-recogida` (única entrada): valida, aplica límites, llama a la función SQL y devuelve `{venta_id, numero_ticket, total, expira_el, lineas}`.
- [ ] `marcar_pedido_cobrado(venta_id, metodo)` solo para usuarios autenticados; solo acepta `efectivo`/`tarjeta`, solo sobre reservas `recogida` sin cobrar y no canceladas.
- [ ] Si la reserva caduca (7 días) se cancela y repone stock con el cron actual, sin cambios en esa función.

### Seguridad (pedidos falsos, abuso e inyección)
- [ ] **Validación estricta en el servidor** (nunca confiar en el navegador): líneas 1–10; cantidad por línea 1–5; máx. 20 unidades por pedido; `id` UUID; `talla` ≤ 10 caracteres; `colorId` ≤ 64; nombre 2–80 caracteres; teléfono normalizado (móvil español de 9 dígitos que empiece por 6–9, o internacional de 7–15 dígitos); email ≤ 120 con formato válido; notas ≤ 300. Campos desconocidos se ignoran; cualquier valor fuera de rango devuelve 400 con mensaje genérico.
- [ ] Se eliminan caracteres de control, de ancho cero y de anulación bidireccional; se normaliza Unicode (NFC) y se colapsan espacios. El texto se guarda **tal cual como texto plano**, sin interpretarse nunca como HTML, SQL ni instrucciones.
- [ ] **Sin inyección SQL:** todo entra como parámetros tipados (JSON → `jsonb_to_recordset`/argumentos de función); ninguna consulta se arma concatenando texto del usuario.
- [ ] **Sin XSS:** el admin renderiza estos campos como texto de React; el email al admin escapa HTML en todos los campos del usuario; el texto de WhatsApp y el PNG nunca ejecutan nada.
- [ ] **Prompt injection:** ningún dato del formulario se envía a un modelo de lenguaje en este flujo. Si en el futuro algo lo hiciera, estos campos se tratarán como datos no confiables. Se deja constancia en el código de la edge function.
- [ ] **Límites de frecuencia** (tabla `pedido_rate_limits`, guardando un hash de la IP con sal, nunca la IP): máx. 5 reservas/hora y 15/día por IP; máx. 5/día por teléfono; máx. **2 reservas abiertas** (sin cobrar y sin cancelar) por teléfono; tope global de **40 reservas abiertas** a la vez. Al superarlos: HTTP 429 y mensaje «Escríbenos por WhatsApp».
- [ ] **Antibots:** campo señuelo (honeypot) que debe llegar vacío; tiempo mínimo de 2,5 s entre abrir el formulario y enviarlo; comprobación del encabezado `Origin` con lista exacta de dominios (`stylo019.es`, `www.stylo019.es`, `localhost` en desarrollo). **Cloudflare Turnstile** queda como decisión abierta (ver abajo).
- [ ] El `Origin` se compara por dominio exacto, no con `endsWith` (ver nota sobre `create-checkout-session`).
- [ ] La tabla `pedido_rate_limits` tiene RLS activado y ninguna política (solo `service_role`).
- [ ] Los errores devueltos al navegador no exponen mensajes internos de Postgres ni de Deno; el detalle se registra en logs **sin datos personales**.
- [ ] La edge function no depende de que la clienta tenga sesión (`verify_jwt = false`, como `create-checkout-session`), por eso las defensas anteriores son obligatorias.

### Admin
- [ ] En la lista y el detalle de pedidos, las reservas muestran «Web · Recogida en tienda» y una etiqueta «Pendiente de cobro» mientras `pagado_at` sea nulo y el pedido no esté cancelado.
- [ ] El detalle tiene «Marcar como cobrado» (efectivo/tarjeta) que llama a `marcar_pedido_cobrado`.
- [ ] El teléfono de la clienta se muestra con enlace `https://wa.me/…` para contactarla.
- [ ] El aviso al cancelar una reserva sin cobrar dice que no hay dinero que devolver y que solo se repone stock.
- [ ] El dashboard cuenta como **ingresos** solo las ventas con `pagado_at`; las reservas abiertas aparecen aparte como «Por cobrar» (cantidad e importe).
- [ ] El badge de pendientes del nav sigue contando `estado = 'pendiente'` (incluye reservas), sin cambios.
- [ ] El admin recibe un email (Resend, mismo remitente que el de Stripe) por cada reserva nueva; si el envío falla, la reserva **no** se pierde ni se revierte.

## Fuera de alcance
- Envío **automático** por WhatsApp desde el servidor: requiere WhatsApp Business API / Twilio y una cuenta que la tienda no tiene (ver `badge-pedidos-pendientes.md`). La clienta lo envía con un clic.
- PDF del comprobante.
- Email de confirmación a la clienta (el email se guarda por si se quiere usar más adelante).
- Sincronización con Odoo de las reservas (solo tendría sentido al cobrar).
- Pago online de una reserva ya creada.
- Cambios en `create-checkout-session`, `stripe-webhook` y en `crear_venta_web`/`crear_venta_tpv`.
- Correcciones de seguridad en flujos existentes (ver «Hallazgos fuera de alcance»).

## Decisiones abiertas (necesitan respuesta antes de implementar)
1. **Cloudflare Turnstile** (CAPTCHA gratuito y poco intrusivo): es la defensa más fuerte contra pedidos falsos automatizados, pero necesita crear un sitio en Cloudflare y guardar la clave secreta en la edge function. Sin él, la protección se apoya en límites, señuelo y tiempo mínimo. Recomendación: activarlo.
2. **Dirección de la tienda para el comprobante:** el proyecto tiene **tres** versiones y la clienta irá a recoger allí.
   - `Privacidad.jsx` y el ticket impreso (`TicketVenta.jsx`): «Calle Ciudad de Carlet, 10, Local 2 — Parque Alcosa, 41019 Sevilla».
   - Email de `stripe-webhook`: «Av. Ildefonso Marañón Lavín, 9 · Sevilla».
   - Cabecera de este `CLAUDE.md`: «C/ Sierpes, Centro Histórico».
   Propuesta: usar la del ticket y la página legal (Calle Ciudad de Carlet, 10, Local 2), que es la más reciente y la que ya sale en documentos oficiales. **Pendiente de confirmar por el usuario.**
3. **Teléfono de WhatsApp:** el código del carrito usa `34638970807` (confirmado por el usuario, es el que se usa en el comprobante). `Privacidad.jsx` y el botón flotante muestran «658 509 332». Unificar los textos visibles queda fuera de esta feature, pero conviene decidirlo porque la página de privacidad es un documento legal.

## Hallazgos fuera de alcance (no se tocan en esta feature)
- `create-checkout-session` valida el dominio de retorno con `hostname.endsWith(s)`, lo que acepta dominios como `xstylo019.es`. Debería ser comparación exacta.
- `stripe-webhook` inserta nombre y email del cliente en el HTML del email sin escapar.
- `expirar_ventas_pendientes` cancela cualquier pedido web sin entregar a los 7 días, también si ya está pagado. En la práctica no ha ocurrido (solo existe 1 pedido web, entregado), pero conviene revisarlo si el canal web crece.

## Plan de pruebas
- **Vitest + React Testing Library** (el repo no tiene pruebas hoy; se añaden como dependencias de desarrollo): validación del formulario, constructor del texto de WhatsApp y del comprobante, comportamiento del carrito (se vacía solo al confirmar), codificación de caracteres especiales y de intentos de inyección.
- **Pruebas de la función SQL y de la edge function** sobre una **rama de Supabase o un proyecto de pruebas, nunca sobre producción**: stock insuficiente, límites, idempotencia, entradas hostiles (SQL, HTML, texto largo, Unicode raro).
- **Playwright** del flujo completo (carrito → formulario → comprobante → WhatsApp), con la edge function **simulada**: no se crean pedidos reales en producción.
- Antes de dar la tarea por terminada se mostrará la salida real de las pruebas.

## Plan de despliegue
1. Flujo de ramas del proyecto (ver su `CLAUDE.md`): solo `main` y `preview`. Se trabaja en una rama corta `feature/retiro-en-tienda` creada desde `preview` → PR a `preview` (se prueba con su deploy de Vercel) → PR a `main` solo tras confirmación expresa en ese momento → se borra la rama corta.
2. La migración `022` y el despliegue de la edge function son cambios en **producción** de kayao: se aplican solo con autorización explícita, mostrando antes el SQL exacto. La migración es aditiva (no borra ni cambia datos existentes).
3. **Las edge functions no tienen entorno de preview:** al desplegar `crear-pedido-recogida` queda activa en producción de inmediato, aunque el código del frontend aún esté en `preview`. Como es una función nueva que nadie llama hasta que el frontend la use, no afecta a la tienda actual; aun así se despliega solo después de probarla en un proyecto de pruebas.
4. Orden de entrega: (a) spec aprobada, (b) pruebas rojas, (c) migración y función en un proyecto de pruebas, (d) frontend en `preview`, (e) autorización para producción, (f) merge a `main`.
3. Como el Supabase de kayao se migrará más adelante a otro proyecto, la migración y el código de la función viven en el repo (`supabase/migrations/022_…`, `supabase/functions/crear-pedido-recogida/`) y se reaplican tal cual en el proyecto nuevo.
