# STATUS

Última actualización: 2026-11-25

## Estado actual
Tienda Stylo019 (React + Vite + **Supabase propio `pqsvvhxtttuacrvvlbiq`** + Vercel del equipo de kayao; `www.stylo019.es` ya sirve ese despliegue). Funciona la compra online con pago, la venta física y la **reserva «recogida y pago en tienda»**: sin pago online, stock reservado 7 días, comprobante que abre el chat de WhatsApp 638 970 807.

## Hecho (verificado)
- Reserva en tienda: migración 022 aplicada, edge function `crear-pedido-recogida` desplegada, pruebas 253 pasando, build correcto (specs/retiro-en-tienda.md)
- Panel admin: reservas por cobrar, marcar cobrado en efectivo/tarjeta, burbuja roja de pendientes y refresco automático cada 30 s (specs/badge-pedidos-pendientes.md)
- WhatsApp unificado en 638 970 807 y dirección Calle Ciudad de Carlet 10, Local 2
- Probado a mano en el preview por el dueño: reserva, comprobante y panel

- Migración a Supabase propio, 2026-11-25: 8 tablas idénticas (163 productos, 26 categorías, 76 ventas) con `verif.py`; 510 imágenes WebP; 4 edge functions y secretos de Stripe/Resend; `main` de kayaosv/Stylo019 en 3330dad (commits de kayaosv); bundle en vivo apunta al host nuevo y 3 imágenes pasan por el optimizador (200)
- Probado en producción por el dueño: reserva desde www.stylo019.es llegó a la base nueva (ticket 84, cancelado después; la base antigua no recibió nada) y el email de aviso llega al reservar. En la preview: pago real con Stripe

- Catálogo ordenado por las categorías del admin (migración 023, vista `productos_catalogo`), Novedades por categoría y filtro de precio visible en móvil, en producción desde `a2348e0` (specs/orden-catalogo-por-categorias.md, 270 tests)

## Pendiente / próximos pasos
- [ ] Logo del ticket (spec `specs/logo-ticket-y-comprobante.md`): hecho en la rama feature/logo-ticket; falta imprimir en la térmica de 80 mm y ver el comprobante en el móvil
- [ ] Pago con Stripe desde www.stylo019.es sin probar; login/gráfico del admin en producción sin confirmar
- [ ] Cierre: quitar webhook antiguo de Stripe, rotar service_role de la base de kayao y pausarla tras unos días estable, borrar `.secrets` y exportaciones con datos personales, `supabase logout`
- [ ] Keep-alive y backup semanal (plan gratuito pausa tras una semana sin actividad); DNS en GoDaddy sin localizar la cuenta; Vercel Hobby es de uso no comercial
- [ ] Pruebas Playwright del flujo de reserva (no hay navegador en el entorno)
- [ ] Decidir subir los límites anti-abuso (hoy 5/h y 15/día por IP, 2 abiertas por teléfono, 40 en total)
- [ ] Reiniciar la secuencia de tickets a 66 (una prueba consumió 67–69)

## Decisiones tomadas
- 2026-11-25: Supabase propio detrás del Vercel de kayao sin tocar el DNS; el código se firma como kayaosv porque Hobby solo despliega commits del dueño del equipo
- 2026-11-25: remitente `onboarding@resend.dev`, el aviso va solo al dueño (modastylo019@gmail.com)
- 2026-10-21: el botón de WhatsApp abre `wa.me/34638970807` con el texto; la hoja de compartir no puede dirigirse a un número
- 2026-10-21: refresco por consulta cada 30 s en vez de realtime (no se confirmó replicación en `ventas`)
- 2026-10-21: sin Cloudflare por ahora

## No verificado / riesgos conocidos
- `index.ts` de la edge function sin pruebas bajo Deno; email real por Resend sin confirmar
- Responsive y `wa.me` en móviles distintos sin comprobar
- Fuera de alcance, detectado: `create-checkout-session` valida el origen con `endsWith`; `stripe-webhook` no escapa HTML; `expirar_ventas_pendientes` cancela a los 7 días también pedidos web pagados sin entregar
