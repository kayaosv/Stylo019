# Orden del catálogo según el orden de categorías

## Objetivo
El catálogo público muestra los productos agrupados por categoría, en el mismo orden que el admin fija en Categorías (arrastrar y soltar). Si el dueño reordena las categorías, el catálogo cambia sin tocar código.

## Contexto verificado (2026-11-25, base `pqsvvhxtttuacrvvlbiq`)
- `categorias(id, nombre, orden, activo)`; el `id` es el slug y `productos.categoria` guarda ese `id`.
- Hoy el catálogo ordena por `created_at desc` (`src/services/productos.js`, rama `novedad`/por defecto) y pagina en el servidor con `range`.
- 163 productos; todos están en categorías activas y ninguno en categorías inactivas o desconocidas. 68 son de `bisuteria` (orden 16).

## Decisiones (confirmadas por el dueño el 2026-11-25)
- Orden por defecto ("Categorías"): `categorias.orden` ascendente, categoría por categoría completa, y dentro de cada una el más nuevo primero. Las categorías nuevas entran solas, siempre según el orden del panel de Categorías.
- "Novedades": los últimos añadidos de cada categoría (el 1.º de cada categoría, luego el 2.º de cada una…), para que 5 productos nuevos de bisutería no copen la primera página.
- Una categoría inactiva (o inexistente) no muestra sus productos en la galería (join interno en la vista).
- `precio_asc`, `precio_desc` y `mas_vendidos` no cambian. El Home sigue pidiendo `novedad`.
- Detalle de producto por enlace directo y productos relacionados no cambian (fuera de la galería).
- Filtro de precio invisible en móvil: el panel de filtros dentro del cajón móvil tenía `sticky` y `max-height: calc(100vh - 10rem)` con su propio scroll dentro del cajón, que ya hace scroll; con `100vh` mayor que la zona visible, el precio y los botones quedaban cortados. En el cajón ahora no limita la altura y el cajón usa `100dvh`.

## Diseño
- Migración 023 (`supabase/migrations/023_productos_catalogo_vista.sql`, aplicada a la base propia el 2026-11-25 con autorización): vista `productos_catalogo` con `security_invoker`, `categoria_orden` y `posicion_en_categoria`. Solo filas de `productos` activos con categoría activa.
- `fetchProductos` lee de la vista. Defecto: `categoria_orden, created_at desc, id`. `novedad`: `posicion_en_categoria, categoria_orden, id`.
- Limitación conocida: `posicion_en_categoria` se calcula antes de los filtros de talla, precio o búsqueda; con filtros el orden relativo se mantiene aunque la posición tenga huecos.
- La vista fija sus columnas al crearla: si se añade una columna a `productos`, hay que recrear la vista.

## Criterios de aceptación
- [x] Orden por defecto por `categoria_orden` y luego `created_at desc` (src/services/productos.test.js)
- [x] Novedades ordena por `posicion_en_categoria`, luego `categoria_orden` (idem)
- [x] `precio_asc`, `precio_desc` y `mas_vendidos` mantienen su orden (idem)
- [x] La paginación con `range` pide páginas contiguas (idem)
- [x] Una categoría inactiva oculta sus productos y cambiar `orden` cambia la primera categoría (comprobado en SQL como `anon` dentro de una transacción revertida: total 158 de 163 con Faldas inactiva, 0 faldas, bisutería primera con orden 0)
- [x] La vista devuelve 163 de 163 como `anon` (RLS respetado)
- [x] El filtro de precio y Buscar están en el cajón móvil sin limitar la altura (src/components/catalogo/Filtros.test.jsx). **Pendiente comprobar a mano en un móvil real.**
- [x] Opciones "Categorías" y "Novedades" (src/components/catalogo/Ordenamiento.test.jsx)
- [x] Suite completa (270 tests) y build pasando
- [ ] Comprobación manual en preview: reordenar dos categorías en el admin y ver el cambio en el catálogo

## Fuera de alcance
- Cambiar la categoría de un producto desde el catálogo.
- Ordenar manualmente productos dentro de una categoría.
- Logo del ticket del TPV (cambio aparte).
