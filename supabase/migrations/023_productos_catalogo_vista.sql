-- Vista del catálogo público: solo productos activos de categorías activas, con el
-- orden de su categoría (el que el admin fija arrastrando en Categorías) y su posición
-- por antigüedad dentro de la categoría (1 = el último añadido de esa categoría).
-- Join interno a propósito: una categoría inactiva o inexistente oculta sus productos.
-- security_invoker: se aplican las políticas RLS de productos y categorias a quien consulta.
create or replace view public.productos_catalogo
with (security_invoker = true) as
select
  p.*,
  c.orden as categoria_orden,
  row_number() over (
    partition by p.categoria
    order by p.created_at desc, p.id
  ) as posicion_en_categoria
from public.productos p
join public.categorias c on c.id = p.categoria and c.activo = true
where p.activo = true;

grant select on public.productos_catalogo to anon, authenticated;
