# ModaMariaJose — E-commerce

## Proyecto
Tienda de ropa para mujer en Sevilla (C/ Sierpes, Centro Histórico).
La cliente vende principalmente por Instagram. Esta web es su canal digital.
Prototipo de referencia: https://web-e-commerce-ma-jo-d4x1.vercel.app/

## Stack
- Frontend: React 18 + Vite + Tailwind CSS + GSAP (@gsap/react)
- Backend: Supabase (PostgreSQL + Auth + Storage)
- Deploy: Vercel
- Package manager: pnpm

## Negocio
- Nombre marca: ModaMariaJose
- Ubicación: Sevilla, España — C/ Sierpes, Centro Histórico
- WhatsApp negocio: 658 509 332
- Modelo de venta: cliente elige producto/talla → consulta por WhatsApp → dueña confirma manualmente
- Sin pasarela de pago en v1 (preparar arquitectura para futura integración)

## Categorías de productos
Vestidos, Blazers, Abrigos, Faldas, Pantalones, Blusas, Curvy

## Tallas
XS, S, M, L, XL — con posibilidad de precio diferente por talla

## Páginas del proyecto
- `/` — Home: hero, novedades, más vendidos, newsletter
- `/catalogo` — Grid de productos con filtros
- `/producto/:id` — Detalle con galería, talla, carrito, WhatsApp
- `/contacto` — Formulario, horarios, ubicación
- `/admin` — CMS privado (Supabase Auth)

## Módulos de desarrollo
- M1: Infraestructura (setup, Supabase, Router, Zustand, Layout)
- M2: Catálogo (grid, filtros, búsqueda, ordenamiento)
- M3: Página de Producto (galería, tallas, carrito, WhatsApp CTA)
- M4: Carrito + Checkout WhatsApp
- M5: Home (hero GSAP, secciones animadas, newsletter)
- M6: Admin CMS (CRUD productos, Supabase Storage, gestión stock)
- M7: Contacto (formulario funcional)
- M8: Diseño global y animaciones (GSAP, tipografía extrema, cursor)

## Nivel de diseño esperado
Esta web NO aspira a nivel Kayao Studio, Awwwards SOTD ni producción de agencia top.
El objetivo es una tienda funcional y visualmente cuidada para una clienta real en Sevilla.
- Diseño editorial y limpio, con personalidad — no genérico
- Animaciones útiles y suaves — no espectáculos de WebGL
- Prioridad: que funcione bien, cargue rápido y sea fácil de usar para la dueña y las clientas
- Los agentes de diseño deben aplicar criterio, no exagerar efectos por defecto

## Reglas de este proyecto
- Comentarios de código en inglés
- Arrow functions siempre
- useGSAP() para toda animación, nunca useEffect para GSAP
- Zustand para estado global (carrito, UI)
- Supabase client como singleton en `src/lib/supabase.js`
- Imágenes: Supabase Storage bucket `products`
- Colores y tokens de diseño en `tailwind.config.js`

## Flujo de ramas
Solo dos ramas viven a largo plazo: `main` (producción, lo que ve la clienta)
y `preview` (integración — todo cambio nuevo entra aquí primero, se prueba
contra su propio deploy de Vercel, y solo se mergea a `main` cuando está
confirmado). No se crean ramas `feature/*` de larga duración; si hace falta
aislar un cambio grande se puede usar una rama corta que se mergea a
`preview` y se borra en seguida. Deploy de Edge Functions es la excepción:
se publican en cuanto se hace `deploy_edge_function`, independientemente de
la rama de git — no hay "preview" de Edge Functions.

## Estado — actualizado 2026-08-03

### 1. Stock por color + talla — implementado 2026-07-16, en producción

Cada color en `productos.colores` puede llevar su propio mapa `tallas`
(migración `009_stock_por_color.sql`). Un trigger DB (`sync_tallas_disponibles`)
agrega el stock por color hacia `productos.tallas`, así todo el código que ya
lee ese campo (banner "Agotado", filtro de catálogo) sigue funcionando sin
tocarlo. Adopción gradual vía el toggle "Stock independiente por color" en
`ProductoForm.jsx` — los productos existentes no se migraron automáticamente.

### 2. Venta física (TPV) + gobernanza de stock + facturación Odoo — en `main` desde 2026-07-31

Misma arquitectura que el TPV de Vapers Alcosa (`kayaosv/AlcosaProduct`,
`/admin/tpv`), adaptada al modelo de stock jsonb de este proyecto (no hay
tabla `product_variants` aquí — los colores son entradas de `productos.colores`,
no filas propias):

- **`/admin/venta-fisica`** (`src/pages/admin/VentaFisica.jsx`) — pantalla de
  cobro en mostrador. Escaneo por pistola de código de barras (input con
  captura de teclado global + `Enter`) o cámara (`BarcodeDetector`), más
  búsqueda por nombre como respaldo básico. Tras un match se abre un selector
  de color (si el producto tiene variantes) y luego de talla (solo tallas con
  stock > 0), se arma el carrito, se elige efectivo/tarjeta y se cobra.
- **`productos.barcode`** (nuevo, único) + `colores[].barcode` (por color,
  sin constraint de unicidad a nivel DB por ser jsonb — se controla en
  `src/lib/barcode.js` reintentando contra `buscar_por_barcode()`).
  `ProductoForm.jsx` tiene un campo + botón "Generar" por cada color activo
  y uno para el producto base (fallback cuando no usa variantes).
- **`buscar_por_barcode(p_barcode)`** — RPC de lookup, revisa primero
  `productos.barcode`, luego escanea `colores[].barcode`. `SECURITY DEFINER`,
  solo `authenticated` (revocado de `anon` explícitamente — este proyecto
  otorga EXECUTE por default a `anon` en funciones nuevas, mismo gotcha ya
  documentado en Alcosa).
- **`crear_venta_tpv(p_items, p_metodo_pago)`** y **`crear_venta_web(...)`**
  (esta última llamada desde `stripe-webhook` al confirmarse el pago) — RPCs
  atómicas (mismo patrón `FOR UPDATE` que `create_pos_sale()` en Alcosa):
  bloquean la fila de cada producto, resuelven precio igual que
  `src/lib/precio.js` (`precios_talla[talla] → precio`, luego `precio_oferta`
  si es menor), y descuentan stock **por variante real, no por agregado**:
  si el color tiene su propio mapa `tallas` (`v_using_color_stock`), descuentan
  ahí (`colores[i].tallas[talla]`); si no, descuentan `productos.tallas[talla]`.
  Verificado contra la función *desplegada en producción* (no solo el archivo
  de migración) el 2026-08-03 con datos reales — ej. "Pantalón Lazo" talla 38
  tiene 1 unidad en Azul y 1 en Burdeos (agregado: 2) y ambas RPCs respetan
  ese reparto, nunca el agregado, al validar y descontar.
- **Tablas `ventas`/`venta_items`** — header + líneas, para que una venta
  completa mapee a una sola factura de Odoo con varias líneas, igual que
  `orders`/`order_items` en Alcosa. RLS: patrón `admin_all` (`authenticated`,
  sin acceso público).
- **Edge Function `odoo-sync`** — llamada fire-and-forget desde
  `VentaFisica.jsx` justo después de `crear_venta_tpv()`: la venta ya quedó
  confirmada y el stock ya se descontó en ese momento, esta función nunca
  bloquea ni revierte una venta si falla. Crea un `account.move` en Odoo vía
  JSON-RPC. **Sin credenciales de Odoo todavía** — falla con gracia
  (`ventas.odoo_sync_status = 'error'`) hasta que se configuren
  `ODOO_URL`/`ODOO_DB`/`ODOO_API_USER`/`ODOO_API_KEY` como secrets de la
  Edge Function. Mismo stub que Alcosa: crea `account.move`, no `pos.order`
  — revisar esa decisión cuando haya credenciales reales + Veri*Factu.
- Ticket impreso (`TicketVenta.jsx`, `window.print()`, ancho 80mm) — no es
  factura legal, usa el CIF/dirección reales ya publicados en
  `Privacidad.jsx`/`Terminos.jsx` (CIF 28753199W, Av. Ildefonso Marañón
  Lavín 9, 41019 Sevilla).

Mergeado a `main` el 2026-07-31 (commit `5cba254`, junto con dashboard de
`/admin` como landing con accesos rápidos). Migraciones `010_venta_fisica_odoo`,
`011_pedidos_web_stock`, `012_fix_ambiguous_columns` (bug real de "column
reference ambiguous" en `crear_venta_tpv`/`crear_venta_web`, encontrado
probando el botón "Cobrar" — ninguna venta se había completado antes de este
fix), `013_barcode_imagenes` y `014_colores_libres_backfill` ya aplicadas en
producción.

**Pendiente**: credenciales de Odoo para ModaMariaJose (nueva cuenta de
usuario dedicada en Odoo, no la cuenta admin del dueño — mismo criterio que
en Alcosa) + decidir si hace falta certificado AEAT/Veri*Factu antes de
emitir facturas reales.

### 3. Catálogo — talla única + colores libres + banner "Agotado" — en `main` desde 2026-08-01

- Talla única (`tipo_talla: 'unica'`) y colores personalizados sin límite fijo
  (cualquier `id` con `label`+`hex` propios vale, ver `isCustomColor` en
  `src/lib/colores.js`) — migración `014_colores_libres_backfill.sql` migró
  los colores fijos antiguos (azul/marrón/beige/gris) al modelo libre.
- Banner de "Agotado" en la galería de producto del catálogo.
- Bizum como método de pago en el checkout (junto a tarjeta vía Stripe).

### 4. Carrito — límite real de stock por variante + errores de checkout legibles — mergeado a `preview` el 2026-08-03, pendiente de subir a `main`

Dos fixes verificados y con Vercel preview en verde, consolidados en la rama
`preview`:

- **No dejar aumentar la cantidad más allá del stock real**
  (`src/store/useCartStore.js`, `src/components/carrito/ItemCarrito.jsx`).
  El tope (`stockDisponible`) se calcula por variante exacta — color
  seleccionado + talla — nunca por el agregado del producto. Cada línea del
  carrito se identifica por `id + talla + colorId`, así que dos colores del
  mismo producto/talla son líneas independientes con su propio tope. El
  backend (`crear_venta_tpv`/`crear_venta_web`, punto 2) vuelve a validar
  contra el stock real de la variante al confirmar la venta — doble
  candado, no solo confianza en el cliente. Limitación conocida y aceptada:
  líneas de carrito guardadas en `localStorage` *antes* de este cambio no
  tienen `stockDisponible` y quedan sin tope hasta que el cliente las vuelva
  a añadir; el backend las revalida igual al pagar.
- **Mostrar el motivo real de un error de checkout**
  (`src/components/carrito/CartDrawer.jsx`, `src/services/stripe.js`).
  Antes, cualquier rechazo del servidor (ej. "Solo quedan 1 unidades de X")
  se mostraba siempre como "No se pudo iniciar el pago" — `supabase.functions.invoke()`
  envuelve errores no-2xx en un `FunctionsHttpError` genérico y el mensaje
  real solo está en `error.context.json()`, que nadie leía. Verificado
  contra el servidor real forzando un HTTP 409 por stock excedido.

**Pendiente**: mergear `preview` a `main` tras confirmar el deploy de
Vercel de `preview`. Una vez en `main`, borrar las ramas `feature/*` ya
absorbidas (`venta-fisica-odoo`, `banner-agotado-galeria`, `bizum-checkout`,
`talla-unica-colores-libres`, `limitar-stock-carrito`,
`errores-checkout-especificos`) — todas quedan subsumidas por `main`/`preview`
y no aportan nada vivo.
