# Badge de pedidos pendientes en el admin

## Objetivo
El dueño no tiene forma de ver, sin entrar a `/admin/pedidos` y revisar la lista, cuántos pedidos están esperando gestión. Se agrega un contador visible en el nav del admin.

## Criterios de aceptación
- [x] El link "Pedidos" del sidebar (desktop) y del drawer (mobile) muestra un badge rojo con la cantidad de ventas en `estado = 'pendiente'`.
- [x] El badge no aparece si el conteo es 0.
- [x] El conteo se actualiza solo cada 30s mientras el admin tiene la pestaña abierta (polling — no requiere que el admin recargue la página).
- [x] No rompe el layout existente del sidebar/drawer en mobile ni desktop.

## Fuera de alcance
- **Envío automático de comprobante por WhatsApp al cliente** — requiere cuenta de WhatsApp Business API (Twilio o Meta Cloud API) con número verificado y plantilla aprobada. El usuario confirmó que todavía no tiene esa cuenta dada de alta (2026-09-23). Queda pendiente como feature separada una vez exista la cuenta — no se escribe código de integración todavía porque no hay forma de probarlo.
- Notificaciones push del navegador (Web Push) — no se pidió, el badge alcanza para el caso de uso descrito.
- Sonido/toast al entrar un pedido nuevo — mismo motivo.
- Cambiar el criterio de "pendiente" (ej. incluir "preparando") — se usa el estado que ya existe en `ventas.estado`, sin agregar campos nuevos.
