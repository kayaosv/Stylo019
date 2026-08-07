-- Adds categoria to the return shape so the TPV scanner can tell a
-- deliberately-hidden 'venta_rapida' item (activo:false, still sellable)
-- from a genuinely discontinued one.
DROP FUNCTION buscar_por_barcode(text);

CREATE FUNCTION public.buscar_por_barcode(p_barcode text)
RETURNS TABLE(producto_id uuid, producto_nombre text, precio numeric, precio_oferta numeric, precios_talla jsonb, tallas jsonb, activo boolean, categoria text, color_id text, color_label text, color_tallas jsonb, imagenes text[], colores jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
    SELECT p.id, p.nombre, p.precio, p.precio_oferta, p.precios_talla, p.tallas, p.activo, p.categoria,
           NULL::TEXT, NULL::TEXT, NULL::JSONB, p.imagenes, p.colores
      FROM productos p
     WHERE p.barcode = p_barcode
     LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT p.id, p.nombre, p.precio, p.precio_oferta, p.precios_talla, p.tallas, p.activo, p.categoria,
           c ->> 'id', COALESCE(c ->> 'label', c ->> 'id'), c -> 'tallas', p.imagenes, p.colores
      FROM productos p, jsonb_array_elements(COALESCE(p.colores, '[]'::JSONB)) AS c
     WHERE c ->> 'barcode' = p_barcode
     LIMIT 1;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.buscar_por_barcode(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.buscar_por_barcode(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_por_barcode(text) TO authenticated;
