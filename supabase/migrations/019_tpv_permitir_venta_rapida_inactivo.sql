-- 'venta_rapida' products are created with activo=false on purpose (RLS
-- hides them from the public catalog: "Public can read active products"
-- policy checks activo=true on every anon query). But crear_venta_tpv's
-- own guard also blocked selling anything inactive — that guard exists to
-- stop selling discontinued items, not these. Carve out the exception by
-- category instead of touching the activo semantics everyone else relies on.
CREATE OR REPLACE FUNCTION public.crear_venta_tpv(p_items jsonb, p_metodo_pago text)
RETURNS TABLE(venta_id uuid, numero_ticket integer, total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_venta_id UUID;
  v_numero_ticket INT;
  v_total NUMERIC := 0;
  v_item RECORD;
  v_producto RECORD;
  v_color JSONB;
  v_color_tallas JSONB;
  v_color_label TEXT;
  v_stock INT;
  v_precio_base NUMERIC;
  v_precio_original NUMERIC;
  v_precio NUMERIC;
  v_using_color_stock BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_metodo_pago NOT IN ('efectivo', 'tarjeta') THEN
    RAISE EXCEPTION 'Método de pago inválido';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El carrito está vacío';
  END IF;

  CREATE TEMP TABLE _venta_lines (
    producto_id UUID,
    producto_nombre TEXT,
    color_id TEXT,
    color_label TEXT,
    talla TEXT,
    cantidad INT,
    precio_unitario NUMERIC,
    precio_original NUMERIC,
    origen_stock TEXT
  ) ON COMMIT DROP;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items)
      AS x(producto_id UUID, color_id TEXT, talla TEXT, cantidad INT, precio_manual NUMERIC)
  LOOP
    IF v_item.producto_id IS NULL OR v_item.talla IS NULL
       OR v_item.cantidad IS NULL OR v_item.cantidad <= 0 THEN
      RAISE EXCEPTION 'Línea de venta inválida';
    END IF;

    SELECT id, nombre, activo, categoria, precio, precio_oferta, precios_talla, tallas, colores
      INTO v_producto
      FROM productos
     WHERE id = v_item.producto_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado';
    END IF;
    IF NOT v_producto.activo AND v_producto.categoria IS DISTINCT FROM 'venta_rapida' THEN
      RAISE EXCEPTION 'El producto "%" ya no está disponible', v_producto.nombre;
    END IF;

    v_precio_base := COALESCE((v_producto.precios_talla ->> v_item.talla)::NUMERIC, v_producto.precio);
    IF v_producto.precio_oferta IS NOT NULL AND v_producto.precio_oferta < v_precio_base THEN
      v_precio_original := v_producto.precio_oferta;
    ELSE
      v_precio_original := v_precio_base;
    END IF;

    IF v_item.precio_manual IS NOT NULL THEN
      IF v_item.precio_manual < 0 OR v_item.precio_manual > v_precio_original THEN
        RAISE EXCEPTION 'Precio manual inválido para "%"', v_producto.nombre;
      END IF;
      v_precio := v_item.precio_manual;
    ELSE
      v_precio := v_precio_original;
    END IF;

    v_color := NULL;
    v_color_label := NULL;
    v_using_color_stock := FALSE;

    IF v_item.color_id IS NOT NULL THEN
      SELECT elem INTO v_color
        FROM jsonb_array_elements(COALESCE(v_producto.colores, '[]'::JSONB)) AS elem
       WHERE elem ->> 'id' = v_item.color_id
       LIMIT 1;

      IF v_color IS NULL THEN
        RAISE EXCEPTION 'Color no encontrado para "%"', v_producto.nombre;
      END IF;

      v_color_label := COALESCE(v_color ->> 'label', v_color ->> 'id');
      v_color_tallas := v_color -> 'tallas';
      v_using_color_stock := jsonb_typeof(v_color_tallas) = 'object';
    END IF;

    IF v_using_color_stock THEN
      v_stock := COALESCE((v_color_tallas ->> v_item.talla)::INT, 0);
      IF v_stock < v_item.cantidad THEN
        RAISE EXCEPTION 'Solo quedan % unidades de "%" (%) talla %', v_stock, v_producto.nombre, v_color_label, v_item.talla;
      END IF;

      UPDATE productos
         SET colores = (
           SELECT jsonb_agg(
             CASE WHEN elem ->> 'id' = v_item.color_id
                  THEN jsonb_set(elem, ARRAY['tallas', v_item.talla], to_jsonb(v_stock - v_item.cantidad))
                  ELSE elem
             END
           )
           FROM jsonb_array_elements(productos.colores) AS elem
         )
       WHERE id = v_item.producto_id;
    ELSE
      v_stock := COALESCE((v_producto.tallas ->> v_item.talla)::INT, 0);
      IF v_stock < v_item.cantidad THEN
        RAISE EXCEPTION 'Solo quedan % unidades de "%" talla %', v_stock, v_producto.nombre, v_item.talla;
      END IF;

      UPDATE productos
         SET tallas = jsonb_set(COALESCE(tallas, '{}'::JSONB), ARRAY[v_item.talla], to_jsonb(v_stock - v_item.cantidad))
       WHERE id = v_item.producto_id;
    END IF;

    v_total := v_total + (v_precio * v_item.cantidad);

    INSERT INTO _venta_lines (producto_id, producto_nombre, color_id, color_label, talla, cantidad, precio_unitario, precio_original, origen_stock)
    VALUES (v_item.producto_id, v_producto.nombre, v_item.color_id, v_color_label, v_item.talla, v_item.cantidad, v_precio,
            CASE WHEN v_precio <> v_precio_original THEN v_precio_original ELSE NULL END,
            CASE WHEN v_using_color_stock THEN 'color' ELSE 'producto' END);
  END LOOP;

  INSERT INTO ventas (total, metodo_pago, canal)
  VALUES (v_total, p_metodo_pago, 'tienda')
  RETURNING ventas.id, ventas.numero_ticket INTO v_venta_id, v_numero_ticket;

  INSERT INTO venta_items (venta_id, producto_id, producto_nombre, color_id, color_label, talla, cantidad, precio_unitario, precio_original, origen_stock)
  SELECT v_venta_id, producto_id, producto_nombre, color_id, color_label, talla, cantidad, precio_unitario, precio_original, origen_stock
    FROM _venta_lines;

  RETURN QUERY SELECT v_venta_id, v_numero_ticket, v_total;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.crear_venta_tpv(jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.crear_venta_tpv(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_venta_tpv(jsonb, text) TO authenticated;
