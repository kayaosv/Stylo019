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

## Pendiente — evaluado 2026-07-14, implementar en próxima sesión

Confirmado con el dueño del proyecto que el banner "Agotado" de la galería (`ProductCard.jsx`)
ya funciona correctamente: solo se activa cuando TODAS las tallas están en 0 (`estaAgotado()`
en `lib/tallas.js`), y cada talla se tacha por separado en la fila de tallas / en
`SelectorTalla.jsx`. No requiere cambios. Quedan dos features nuevas por construir:

### 1. Stock por color + talla (no solo por talla)
Hoy el stock vive únicamente en `productos.tallas` (jsonb talla→cantidad), compartido entre
todos los colores del producto. Los colores (`productos.colores`) solo son galerías de imagen
(id, hex, label, imagenes) sin stock propio.

Cambio propuesto:
- Extender cada entrada de `colores` con su propio mapa `tallas` (mismo shape que el del
  producto: `{S: n, M: n, ...}`).
- Mantener `productos.tallas` como agregado (suma por talla entre colores) vía trigger DB,
  mismo patrón que el trigger existente `trg_sync_tallas_disponibles` — así todo el código que
  ya lee `producto.tallas` (banner "Agotado" en `ProductCard.jsx`, filtro de catálogo por
  talla vía `tallas_disponibles`) sigue funcionando sin tocarlo.
- `Producto.jsx` ya tiene `colorSeleccionado` (estado de color activo, con
  `coloresDisponibles = normalizeColores(producto.colores)`) — conectar `SelectorTalla` al
  mapa `tallas` del color elegido en vez del agregado del producto, para que el picker de
  talla refleje el stock real de ese color.
- Nuevo mensaje "Agotado en este color" cuando el color activo tiene todas sus tallas en 0
  pero el producto en general no.
- Admin `ProductoForm.jsx`: añadir inputs de stock por talla dentro de cada bloque de color
  activo (reusar el input que ya existe para las tallas base, sección `usarColores`).
- Productos sin colores (`usarColores: false`) no cambian — siguen usando `tallas` plano tal
  cual.
- Requiere decidir migración de datos: los productos existentes no tienen split de stock por
  color hoy — o se reparte todo al primer color activo, o se le pide a la dueña que lo
  reintroduzca a mano tras el cambio de esquema.

### 2. Ticket de venta en tienda física (compatibilidad web / física)
Hoy no existe ningún registro de ventas — ni web (el "checkout" solo arma un mensaje de
WhatsApp vía `useCartStore.buildWhatsAppMessage`, sin descuento de stock automático) ni
física. El stock se edita siempre a mano en `ProductoForm.jsx`.

Cambio propuesto:
- Nueva tabla `ventas` (producto_id, color_id nullable, talla, cantidad, precio_unitario,
  canal 'tienda'|'web', numero_ticket, created_at).
- Nueva pantalla admin (ej. `/admin/venta-fisica`) para registrar una venta in situ: producto →
  color (si aplica) → talla → cantidad → confirmar. Debe descontar stock de forma atómica
  (función RPC en Supabase para evitar condiciones de carrera con ventas simultáneas) y generar
  un ticket imprimible/visible con número secuencial, fecha, líneas y total.
- Depende parcialmente del punto 1: si se quiere descontar stock por color en la venta física,
  hay que resolver primero el modelo de stock por color. Si se implementa antes, puede
  descontar solo por talla (modelo actual) sin bloquear lo demás.
- Este registro también sirve como primer historial de ventas del negocio — hoy no existe
  ninguno, ni online ni físico.

Ambos puntos evaluados y documentados; pendientes de confirmación explícita antes de tocar
código o esquema de base de datos.
