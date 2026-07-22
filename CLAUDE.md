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


## Estado — actualizado 2026-07-22

Los dos puntos evaluados el 2026-07-14 (stock por color+talla, venta física) están
**ambos implementados**. Detalle:

### 1. Stock por color + talla — implementado 2026-07-16, en producción

Cada color en `productos.colores` puede llevar su propio mapa `tallas`
(migración `009_stock_por_color.sql`). Un trigger DB (`sync_tallas_disponibles`)
agrega el stock por color hacia `productos.tallas`, así todo el código que ya
lee ese campo (banner "Agotado", filtro de catálogo) sigue funcionando sin
tocarlo. Adopción gradual vía el toggle "Stock independiente por color" en
`ProductoForm.jsx` — los productos existentes no se migraron automáticamente.

### 2. Venta física (TPV) + gobernanza de stock + facturación Odoo — implementado 2026-07-22

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
- **`crear_venta_tpv(p_items, p_metodo_pago)`** — RPC atómica (mismo patrón
  `FOR UPDATE` que `create_pos_sale()` en Alcosa): bloquea la fila de cada
  producto, resuelve precio igual que `src/lib/precio.js`
  (`precios_talla[talla] → precio`, luego `precio_oferta` si es menor),
  descuenta `colores[i].tallas[talla]` cuando el color tiene stock propio o
  `productos.tallas[talla]` en caso contrario (el trigger de la migración 009
  recalcula el agregado solo), inserta en `ventas`/`venta_items`. Guard
  interno `auth.uid() IS NULL` — mismo criterio que el resto del proyecto
  (no hay tabla `profiles`/roles, cualquier sesión autenticada es la única
  cuenta admin de la tienda).
- **Tablas nuevas `ventas`/`venta_items`** — header + líneas (no el modelo
  plano de una fila por línea que se había esbozado originalmente), para que
  una venta completa mapee a una sola factura de Odoo con varias líneas,
  igual que `orders`/`order_items` en Alcosa. RLS: mismo patrón `admin_all`
  que el resto de tablas del proyecto (`authenticated`, sin acceso público).
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

Trabajo en rama `feature/venta-fisica-odoo` (no mergeada a `main` — pendiente
de revisión visual del dueño antes de mergear, ver preview de Vercel).
Migración `010_venta_fisica_odoo.sql` y la Edge Function ya están aplicadas
en la base de datos de producción (additivo, no rompe nada existente) — solo
el código de la UI está todavía en preview.

**Pendiente**: credenciales de Odoo para ModaMariaJose (nueva cuenta de
usuario dedicada en Odoo, no la cuenta admin del dueño — mismo criterio que
en Alcosa) + decidir si hace falta certificado AEAT/Veri*Factu antes de
emitir facturas reales.
