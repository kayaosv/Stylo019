# STATUS

Última actualización: 2026-10-21

## Estado actual
Tienda Stylo019 (React + Vite + Supabase de kayao + Vercel). Funciona la compra online con pago, la venta física y la **reserva «recogida y pago en tienda»**: sin pago online, stock reservado 7 días, comprobante que abre el chat de WhatsApp 638 970 807.

## Hecho (verificado)
- Reserva en tienda: migración 022 aplicada, edge function `crear-pedido-recogida` desplegada, pruebas 253 pasando, build correcto (specs/retiro-en-tienda.md)
- Panel admin: reservas por cobrar, marcar cobrado en efectivo/tarjeta, burbuja roja de pendientes y refresco automático cada 30 s (specs/badge-pedidos-pendientes.md)
- WhatsApp unificado en 638 970 807 y dirección Calle Ciudad de Carlet 10, Local 2
- Probado a mano en el preview por el dueño: reserva, comprobante y panel

## Pendiente / próximos pasos
- [ ] Pruebas Playwright del flujo de reserva (no hay navegador en el entorno)
- [ ] Decidir subir los límites anti-abuso (hoy 5/h y 15/día por IP, 2 abiertas por teléfono, 40 en total)
- [ ] Reiniciar la secuencia de tickets a 66 (una prueba consumió 67–69)
- [ ] Migración a un Supabase y Vercel propios (esquema, datos, 294 imágenes ya rescatadas en local; falta autorización y la clave del proyecto nuevo)

## Decisiones tomadas
- 2026-10-21: el botón de WhatsApp abre `wa.me/34638970807` con el texto; la hoja de compartir no puede dirigirse a un número
- 2026-10-21: refresco por consulta cada 30 s en vez de realtime (no se confirmó replicación en `ventas`)
- 2026-10-21: sin Cloudflare por ahora

## No verificado / riesgos conocidos
- `index.ts` de la edge function sin pruebas bajo Deno; email real por Resend sin confirmar
- Responsive y `wa.me` en móviles distintos sin comprobar
- Fuera de alcance, detectado: `create-checkout-session` valida el origen con `endsWith`; `stripe-webhook` no escapa HTML; `expirar_ventas_pendientes` cancela a los 7 días también pedidos web pagados sin entregar
