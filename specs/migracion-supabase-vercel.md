# Migración de Stylo019 a Supabase y Vercel propios

## Objetivo
Sacar la tienda del Supabase de kayao (`htviiigjxmtixjbniskt`, bloqueado por cuota de almacenamiento) y llevarla a un Supabase y un Vercel propios, sin perder datos ni imágenes.

## Punto de partida (2026-10-21)
- Destino anterior: Supabase `pqsvvhxtttuacrvvlbiq`. El dueño también habló de crear uno nuevo gratuito: **confirmar cuál se usa**.
- Rescate local ya hecho en `../stylo019-export/`: 294 imágenes originales (604 MB, verificadas por checksum), `archivos-referenciados.txt` y `datos/*.json`.
- Los JSON de datos **no incluyen** las columnas de la migración 022: hay que volver a exportar.
- Los datos contienen datos personales (clientes, teléfonos): no subirlos a ningún repositorio.

## Criterios de aceptación
- [ ] Esquema completo en el proyecto nuevo (migraciones 001–022 en orden)
- [ ] Datos cargados y conteos por tabla iguales al origen
- [ ] Las 294 imágenes en el bucket nuevo, con las mismas rutas; las URLs de `productos` y `site_settings` apuntan al proyecto nuevo
- [ ] Edge functions desplegadas: `crear-pedido-recogida`, `create-checkout-session`, `stripe-webhook`, `odoo-sync`
- [ ] Secretos configurados: Resend, Stripe, Odoo, destino de avisos
- [ ] pg_cron `expirar_ventas_pendientes` activo
- [ ] Permisos: la función SQL de reservas solo la ejecuta `service_role`; RLS comprobada
- [ ] Vercel nuevo con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del proyecto nuevo; `vercel.json` (`images.domains`) e `index.html` actualizados
- [ ] Reserva de prueba de punta a punta en el preview nuevo
- [ ] Dominio `stylo019.es` movido y webhook de Stripe apuntando al nuevo

## Pasos, en este orden
1. Elegir el destino y guardar su `service_role` en `proyectos_digidot/.secrets` como `SB_DST_SERVICE_KEY` (nunca imprimirla).
2. **Autorización expresa del dueño** antes de aplicar nada: "aplica etapa 1".
3. Etapa 1, esquema: aplicar migraciones 001–022, buckets y políticas, extensiones (`pg_cron`).
4. Etapa 2, datos: re-exportar del origen y cargar; comparar conteos.
5. Etapa 3, imágenes: subir las 294. El plan gratuito da 1 GB de almacenamiento y las originales pesan 604 MB: caben, pero conviene comprimir si se añaden más.
6. Etapa 4, funciones y secretos.
7. Etapa 5, Vercel: proyecto nuevo, variables, preview, prueba de reserva y de compra.
8. Etapa 6, dominio: quitarlo del Vercel de kayao, añadirlo al nuevo y cambiar el DNS donde se gestione.
9. Cierre: rotar la `service_role` del origen, borrar `.secrets` y las exportaciones con datos personales.

## Fuera de alcance
- Borrar las imágenes huérfanas del proyecto de kayao (necesita su aprobación).
- Cambios de funcionalidad.

## Cambios futuros anotados (no hechos)
- Subir límites anti-abuso de la reserva: 10/h y 30/día por IP, 3 abiertas por teléfono, 100 en total (hoy 5/15/2/40). Es cambio de base de datos: autorización expresa. Hacerlo en el proyecto nuevo evita tocar producción dos veces.
- Reiniciar la secuencia `ventas_numero_ticket_seq` a 66 (la prueba consumió 67–69).
- Pruebas Playwright de la reserva.
- Corregir `create-checkout-session` (origen validado con `endsWith`), `stripe-webhook` (no escapa HTML) y `expirar_ventas_pendientes` (cancela a los 7 días también pedidos web ya pagados).
- Notificación sonora o del navegador para pedidos nuevos; realtime si se confirma la replicación de `ventas`.
