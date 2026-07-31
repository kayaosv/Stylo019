-- buscar_por_barcode() no devolvia imagenes ni el jsonb completo de
-- colores -- el TPV (VentaFisica.jsx) no tenia forma de mostrar una
-- foto del producto en ningun paso (escaneo, busqueda por nombre,
-- eleccion de color/talla, carrito), asi que quien vende no puede
-- confirmar visualmente el articulo. Se amplia el RETURNS TABLE con
-- imagenes (foto base del producto) y colores (jsonb completo, para
-- resolver la foto especifica del color elegido en el cliente).
--
-- Postgres no permite cambiar el tipo de retorno con CREATE OR REPLACE,
-- hace falta DROP + CREATE.
DROP FUNCTION IF EXISTS public.buscar_por_barcode(TEXT);

CREATE FUNCTION public.buscar_por_barcode(p_barcode TEXT)
RETURNS TABLE (
  producto_id UUID,
  producto_nombre TEXT,
  precio NUMERIC,
  precio_oferta NUMERIC,
  precios_talla JSONB,
  tallas JSONB,
  activo BOOLEAN,
  color_id TEXT,
  color_label TEXT,
  color_tallas JSONB,
  imagenes TEXT[],
  colores JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT p.id, p.nombre, p.precio, p.precio_oferta, p.precios_talla, p.tallas, p.activo,
           NULL::TEXT, NULL::TEXT, NULL::JSONB, p.imagenes, p.colores
      FROM productos p
     WHERE p.barcode = p_barcode
     LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT p.id, p.nombre, p.precio, p.precio_oferta, p.precios_talla, p.tallas, p.activo,
           c ->> 'id', COALESCE(c ->> 'label', c ->> 'id'), c -> 'tallas', p.imagenes, p.colores
      FROM productos p, jsonb_array_elements(COALESCE(p.colores, '[]'::JSONB)) AS c
     WHERE c ->> 'barcode' = p_barcode
     LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.buscar_por_barcode(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_por_barcode(TEXT) TO authenticated;
-- Este proyecto otorga EXECUTE a anon por defecto en funciones nuevas;
-- REVOKE ALL FROM PUBLIC arriba no alcanza, hay que revocar anon aparte
-- (mismo gotcha documentado para el resto de RPCs de este proyecto).
REVOKE EXECUTE ON FUNCTION public.buscar_por_barcode(TEXT) FROM anon;
