-- ============================================================
-- 022 — Reserva "recogida y pago en tienda"
--
-- Pedido web sin pago online: el stock se reserva al crear el pedido y la
-- reserva caduca a los 7 días con el cron existente (expirar_ventas_pendientes,
-- sin cambios). Solo añade columnas, una tabla y funciones nuevas; no modifica
-- ninguna función existente.
-- ============================================================

-- 1) ventas: estado de cobro separado del estado logístico.
ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS pagado_at timestamptz,
  ADD COLUMN IF NOT EXISTS cobrado_con text,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

-- Toda venta anterior a esta migración ya estaba cobrada. Excluye 'recogida'
-- para que volver a aplicar el script nunca marque una reserva como cobrada.
UPDATE public.ventas
   SET pagado_at = created_at
 WHERE pagado_at IS NULL AND metodo_pago <> 'recogida';

-- Las ventas de TPV y Stripe siguen cobradas sin tocar sus funciones; la
-- reserva inserta NULL de forma explícita.
ALTER TABLE public.ventas ALTER COLUMN pagado_at SET DEFAULT now();

ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS ventas_cobrado_con_check;
ALTER TABLE public.ventas ADD CONSTRAINT ventas_cobrado_con_check
  CHECK (cobrado_con IS NULL OR cobrado_con IN ('efectivo', 'tarjeta'));

ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS ventas_metodo_pago_check;
ALTER TABLE public.ventas ADD CONSTRAINT ventas_metodo_pago_check
  CHECK (metodo_pago = ANY (ARRAY['efectivo'::text, 'tarjeta'::text, 'stripe'::text, 'recogida'::text]));

CREATE UNIQUE INDEX IF NOT EXISTS ventas_idempotency_key_key
  ON public.ventas (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ventas_reservas_abiertas_idx
  ON public.ventas (cliente_telefono)
  WHERE metodo_pago = 'recogida' AND pagado_at IS NULL AND estado <> 'cancelado';

-- 2) Límites de frecuencia. Guarda un hash de la IP, nunca la IP.
CREATE TABLE IF NOT EXISTS public.pedido_rate_limits (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedido_rate_limits_clave_idx
  ON public.pedido_rate_limits (clave, created_at DESC);
ALTER TABLE public.pedido_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pedido_rate_limits FROM anon, authenticated;

-- 3) Respuesta canónica de una reserva (la usa el comprobante del navegador).
CREATE OR REPLACE FUNCTION public._pedido_recogida_respuesta(p_venta_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'ok', true,
    'venta_id', v.id,
    'numero_ticket', v.numero_ticket,
    'total', v.total,
    'creado_el', v.created_at,
    -- Must match the 7 days used by expirar_ventas_pendientes().
    'expira_el', v.created_at + interval '7 days',
    'cliente_nombre', v.cliente_nombre,
    'cliente_telefono', v.cliente_telefono,
    'lineas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'producto_nombre', i.producto_nombre,
               'color_label', i.color_label,
               'talla', i.talla,
               'cantidad', i.cantidad,
               'precio_unitario', i.precio_unitario
             ) ORDER BY i.producto_nombre, i.talla)
        FROM venta_items i WHERE i.venta_id = v.id
    ), '[]'::jsonb)
  )
  FROM ventas v WHERE v.id = p_venta_id
$function$;

-- 4) Crear la reserva. Solo la ejecuta service_role (la edge function
--    crear-pedido-recogida es la única puerta). Los errores de negocio y de
--    límites vuelven como JSON; así el intento queda registrado en
--    pedido_rate_limits aunque la reserva falle.
CREATE OR REPLACE FUNCTION public.crear_pedido_recogida(
  p_items jsonb,
  p_nombre text,
  p_telefono text,
  p_email text,
  p_notas text,
  p_ip_hash text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c_max_lineas          CONSTANT int := 10;
  c_max_cantidad_linea  CONSTANT int := 5;
  c_max_unidades        CONSTANT int := 20;
  c_max_ip_hora         CONSTANT int := 5;
  c_max_ip_dia          CONSTANT int := 15;
  c_max_tel_dia         CONSTANT int := 5;
  c_max_abiertas_tel    CONSTANT int := 2;
  c_max_abiertas_global CONSTANT int := 40;

  v_ip_key    text := 'ip:' || COALESCE(p_ip_hash, 'desconocida');
  v_tel_key   text := 'tel:' || COALESCE(p_telefono, '');
  v_existente uuid;
  v_item      RECORD;
  v_producto  RECORD;
  v_color     JSONB;
  v_color_tallas JSONB;
  v_color_label  TEXT;
  v_stock     INT;
  v_precio_base NUMERIC;
  v_precio    NUMERIC;
  v_using_color_stock BOOLEAN;
  v_total     NUMERIC := 0;
  v_lineas    JSONB := '[]'::jsonb;
  v_venta_id  UUID;
BEGIN
  -- Retry of the same request: return the original reservation.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existente FROM ventas WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN public._pedido_recogida_respuesta(v_existente) || jsonb_build_object('repetido', true);
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > c_max_lineas THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NEGOCIO', 'message', 'El pedido no es válido');
  END IF;

  IF p_nombre IS NULL OR char_length(p_nombre) NOT BETWEEN 2 AND 80
     OR p_telefono IS NULL OR p_telefono !~ '^\+?[0-9]{7,15}$'
     OR char_length(COALESCE(p_email, '')) > 120
     OR char_length(COALESCE(p_notas, '')) > 300 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NEGOCIO', 'message', 'Los datos de contacto no son válidos');
  END IF;

  IF (SELECT COALESCE(sum(x.cantidad), 0)
        FROM jsonb_to_recordset(p_items) AS x(cantidad int)) > c_max_unidades THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NEGOCIO', 'message', 'Demasiadas unidades en un solo pedido');
  END IF;

  DELETE FROM pedido_rate_limits WHERE created_at < now() - interval '2 days';

  IF (SELECT count(*) FROM pedido_rate_limits
       WHERE clave = v_ip_key AND created_at > now() - interval '1 hour') >= c_max_ip_hora
     OR (SELECT count(*) FROM pedido_rate_limits
          WHERE clave = v_ip_key AND created_at > now() - interval '1 day') >= c_max_ip_dia THEN
    RETURN jsonb_build_object('ok', false, 'code', 'LIMITE_IP');
  END IF;

  IF (SELECT count(*) FROM pedido_rate_limits
       WHERE clave = v_tel_key AND created_at > now() - interval '1 day') >= c_max_tel_dia
     OR (SELECT count(*) FROM ventas
          WHERE metodo_pago = 'recogida' AND pagado_at IS NULL AND estado <> 'cancelado'
            AND cliente_telefono = p_telefono) >= c_max_abiertas_tel THEN
    RETURN jsonb_build_object('ok', false, 'code', 'LIMITE_TELEFONO');
  END IF;

  IF (SELECT count(*) FROM ventas
       WHERE metodo_pago = 'recogida' AND pagado_at IS NULL AND estado <> 'cancelado') >= c_max_abiertas_global THEN
    RETURN jsonb_build_object('ok', false, 'code', 'LIMITE_GLOBAL');
  END IF;

  INSERT INTO pedido_rate_limits (clave) VALUES (v_ip_key), (v_tel_key);

  -- Business logic in a sub-transaction: a failure rolls back stock changes
  -- but keeps the attempt rows above.
  BEGIN
    -- Lock products in a fixed order so two concurrent orders cannot deadlock.
    FOR v_item IN
      SELECT * FROM jsonb_to_recordset(p_items)
        AS x(producto_id UUID, color_id TEXT, talla TEXT, cantidad INT)
       ORDER BY x.producto_id, x.color_id NULLS FIRST, x.talla
    LOOP
      IF v_item.producto_id IS NULL OR v_item.talla IS NULL OR v_item.cantidad IS NULL
         OR v_item.cantidad < 1 OR v_item.cantidad > c_max_cantidad_linea THEN
        RAISE EXCEPTION 'Línea de pedido inválida';
      END IF;

      SELECT id, nombre, activo, precio, precio_oferta, precios_talla, tallas, colores
        INTO v_producto
        FROM productos
       WHERE id = v_item.producto_id
       FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto no encontrado';
      END IF;
      IF NOT v_producto.activo THEN
        RAISE EXCEPTION 'El producto "%" ya no está disponible', v_producto.nombre;
      END IF;

      v_precio_base := COALESCE((v_producto.precios_talla ->> v_item.talla)::NUMERIC, v_producto.precio);
      IF v_producto.precio_oferta IS NOT NULL AND v_producto.precio_oferta < v_precio_base THEN
        v_precio := v_producto.precio_oferta;
      ELSE
        v_precio := v_precio_base;
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
      v_lineas := v_lineas || jsonb_build_object(
        'producto_id', v_item.producto_id,
        'producto_nombre', v_producto.nombre,
        'color_id', v_item.color_id,
        'color_label', v_color_label,
        'talla', v_item.talla,
        'cantidad', v_item.cantidad,
        'precio_unitario', v_precio,
        'origen_stock', CASE WHEN v_using_color_stock THEN 'color' ELSE 'producto' END
      );
    END LOOP;

    INSERT INTO ventas (
      total, metodo_pago, canal, estado, pagado_at,
      cliente_nombre, cliente_email, cliente_telefono, notas, idempotency_key
    )
    VALUES (
      v_total, 'recogida', 'web', 'pendiente', NULL,
      p_nombre, NULLIF(p_email, ''), p_telefono, NULLIF(p_notas, ''), p_idempotency_key
    )
    RETURNING id INTO v_venta_id;

    INSERT INTO venta_items (
      venta_id, producto_id, producto_nombre, color_id, color_label,
      talla, cantidad, precio_unitario, origen_stock
    )
    SELECT v_venta_id, l.producto_id, l.producto_nombre, l.color_id, l.color_label,
           l.talla, l.cantidad, l.precio_unitario, l.origen_stock
      FROM jsonb_to_recordset(v_lineas) AS l(
        producto_id uuid, producto_nombre text, color_id text, color_label text,
        talla text, cantidad int, precio_unitario numeric, origen_stock text
      );

    RETURN public._pedido_recogida_respuesta(v_venta_id);
  EXCEPTION
    WHEN unique_violation THEN
      -- Two concurrent requests with the same idempotency key.
      SELECT id INTO v_existente FROM ventas WHERE idempotency_key = p_idempotency_key;
      IF FOUND THEN
        RETURN public._pedido_recogida_respuesta(v_existente) || jsonb_build_object('repetido', true);
      END IF;
      RETURN jsonb_build_object('ok', false, 'code', 'INTERNO');
    WHEN raise_exception THEN
      -- Messages raised above are written for the customer.
      RETURN jsonb_build_object('ok', false, 'code', 'NEGOCIO', 'message', SQLERRM);
    WHEN OTHERS THEN
      RAISE LOG 'crear_pedido_recogida failed: SQLSTATE %', SQLSTATE;
      RETURN jsonb_build_object('ok', false, 'code', 'INTERNO');
  END;
END;
$function$;

-- 5) Marcar una reserva como cobrada (admin).
CREATE OR REPLACE FUNCTION public.marcar_pedido_cobrado(p_venta_id uuid, p_metodo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_metodo NOT IN ('efectivo', 'tarjeta') THEN
    RAISE EXCEPTION 'Método de cobro inválido';
  END IF;

  UPDATE ventas
     SET pagado_at = now(), cobrado_con = p_metodo
   WHERE id = p_venta_id
     AND metodo_pago = 'recogida'
     AND pagado_at IS NULL
     AND estado <> 'cancelado';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La reserva no existe, ya está cobrada o está cancelada';
  END IF;
END;
$function$;

-- This project grants EXECUTE to anon by default on new functions; revoke it.
REVOKE ALL ON FUNCTION public._pedido_recogida_respuesta(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crear_pedido_recogida(jsonb, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marcar_pedido_cobrado(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._pedido_recogida_respuesta(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.crear_pedido_recogida(jsonb, text, text, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.marcar_pedido_cobrado(uuid, text) TO authenticated, service_role;
