# Logo de Stylo en el ticket del TPV y en el comprobante de reserva

## Objetivo
El ticket impreso del TPV (impresora térmica de 80 mm) y el comprobante de la reserva "recogida y pago en tienda" llevan el mismo logo manuscrito de Stylo019 Moda, con buen aspecto en cada soporte.

## Contexto verificado (2026-11-25)
- `TicketVenta.jsx` ya cargaba `/logo-ticket.png`: 1342×1172 px, RGB, 1,2 MB, con adornos azules que una térmica convierte en tramas grises. Se mostraba a 140 px.
- El comprobante de reserva es un PNG dibujado en un canvas (`generarComprobantePng`, 800 px), que se descarga o se comparte por WhatsApp, y se resume en pantalla en `ReservaTienda.jsx`. No llevaba logo.
- Impresora del dueño: 80 mm (576 puntos en 72 mm, 8 puntos/mm).

## Decisiones
- Ticket térmico: `public/logo-ticket-termica.png`, 1 bit (negro puro sobre blanco), 432 px de ancho = 54 mm exactos a 8 puntos/mm, para que el navegador no reescale ni dither (6 KB). Se imprime con `width: 54mm`.
- Comprobante y pantalla: `public/logo-stylo.webp`, a color, 680 px (65 KB). En el PNG se dibuja centrado, 360 px de ancho en el lienzo de 800 px.
- Si el logo no carga (red, caché), el comprobante se genera igual sin él: no puede bloquear el envío de una reserva.
- Se borra `public/logo-ticket.png` (1,2 MB), que deja de usarse.

## Criterios de aceptación
- [x] El ticket del TPV usa el logo térmico, con nombre accesible "Stylo019" y ancho de 54 mm.
- [x] El ticket fuerza negro exacto al imprimir (`print-color-adjust: exact`).
- [x] El comprobante PNG dibuja el logo centrado arriba y desplaza el contenido para no taparlo.
- [x] Si el logo falla al cargar, el comprobante se genera igual, sin logo.
- [x] El resumen de la reserva en pantalla muestra el logo.
- [x] Suite completa (274 tests) y build pasando.
- [ ] Comprobación manual: impresión real en la térmica de 80 mm y comprobante abierto en el móvil.

## Notas del dueño para después
- Reducir un poco el logo del ticket térmico (se ve algo grande).
- Mostrar la foto del producto en el comprobante digital de retiro en tienda (hoy es un PNG; el dueño habla de PDF).

## Fuera de alcance
- Cambiar textos, datos fiscales o la distribución del ticket.
- Ticket de reserva imprimible desde el admin.
