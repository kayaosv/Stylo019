-- ============================================================
-- ModaMariaJose — Web orders + stock governance (reserve at payment,
-- restore on cancel, auto-expire stale pending orders)
-- ============================================================
-- Same model as Vapers Alcosa's real orders flow: stock decrements the
-- moment payment is confirmed (Stripe webhook), not at "Entregado" — an
-- order sitting in Preparando/Listo has already removed that unit from
-- what other customers can buy, so two people can never buy the last one.
-- Cancelling restores stock. New here (Alcosa doesn't have this): a
-- pg_cron sweep auto-cancels+restocks web orders that sit unfulfilled for
-- 7 days without being delivered or cancelled by an admin.
--
-- Reuses the `ventas`/`venta_items` tables from migration 010 (already
-- had a `canal` column anticipating this) instead of a separate `pedidos`
-- table — TPV sales (canal='tienda') stay instantly 'entregado' as today,
-- web orders (canal='web') get the real pending -> ... -> entregado
-- workflow below.

-- ------------------------------------------------------------
-- Schema additions
-- ------------------------------------------------------------
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'entregado';
ALTER TABLE ventas ADD CONSTRAINT ventas_estado_check
  CHECK (estado IN ('pendiente', 'preparando', 'listo', 'entregado', 'cancelado'));

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cliente_nombre TEXT;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cliente_email TEXT;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cliente_telefono TEXT;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cliente_direccion TEXT;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
ALTER TABLE ventas ADD CONSTRAINT ventas_stripe_session_id_key UNIQUE (stripe_session_id);

-- 'stripe' added alongside the two in-store methods from migration 010.
ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_metodo_pago_check;
ALTER TABLE ventas ADD CONSTRAINT ventas_metodo_pago_check
  CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'stripe'));

-- Records which bucket a line's stock came from (productos.tallas vs
-- colores[i].tallas) at sale time, so cancelling restocks the exact same
-- place regardless of any catalog edits made in between (e.g. an admin
-- toggling "stock independiente por color" after the sale — re-deriving
-- this from current product state at cancel time would risk restocking
-- the wrong bucket).
ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS origen_stock TEXT NOT NULL DEFAULT 'producto'
  CHECK (origen_stock IN ('color', 'producto'));

-- ------------------------------------------------------------
-- Redeploy crear_venta_tpv (migration 010) unchanged except for recording
-- origen_stock on each line — needed so cancelar_venta() can restock the
-- exact same bucket a TPV sale came from, same reasoning as venta_items
-- above.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_venta_tpv(
  p_items JSONB,
  p_metodo_pago TEXT
)
RETURNS TABLE (venta_id UUID, numero_ticket INT, total NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    origen_stock TEXT
  ) ON COMMIT DROP;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items)
      AS x(producto_id UUID, color_id TEXT, talla TEXT, cantidad INT)
  LOOP
    IF v_item.producto_id IS NULL OR v_item.talla IS NULL
       OR v_item.cantidad IS NULL OR v_item.cantidad <= 0 THEN
      RAISE EXCEPTION 'Línea de venta inválida';
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

    INSERT INTO _venta_lines (producto_id, producto_nombre, color_id, color_label, talla, cantidad, precio_unitario, origen_stock)
    VALUES (v_item.producto_id, v_producto.nombre, v_item.color_id, v_color_label, v_item.talla, v_item.cantidad, v_precio,
            CASE WHEN v_using_color_stock THEN 'color' ELSE 'producto' END);
  END LOOP;

  INSERT INTO ventas (total, metodo_pago, canal)
  VALUES (v_total, p_metodo_pago, 'tienda')
  RETURNING id, numero_ticket INTO v_venta_id, v_numero_ticket;

  INSERT INTO venta_items (venta_id, producto_id, producto_nombre, color_id, color_label, talla, cantidad, precio_unitario, origen_stock)
  SELECT v_venta_id, producto_id, producto_nombre, color_id, color_label, talla, cantidad, precio_unitario, origen_stock
    FROM _venta_lines;

  RETURN QUERY SELECT v_venta_id, v_numero_ticket, v_total;
END;
$$;
-- Grants unchanged from migration 010 (CREATE OR REPLACE keeps them).

-- ------------------------------------------------------------
-- Staging table for the Stripe checkout flow — same reason as Alcosa's
-- checkout_drafts: Stripe session metadata has a 500-char-per-value
-- limit, too small for a real cart. Only product_id/color_id/talla/
-- cantidad are staged here (no price — crear_venta_web resolves price
-- authoritatively from the live catalog at payment-confirmation time,
-- same as crear_venta_tpv). No customer fields either: unlike Alcosa,
-- this storefront has no pre-checkout form — Stripe's own hosted page
-- collects email/shipping address, available at webhook time via
-- session.customer_details / session.shipping_details.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkout_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  items JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ
);

-- Not exposed to anon/authenticated via PostgREST — only the service
-- role (Edge Functions) touches this table, so RLS stays enabled with
-- no policies (default-deny).
ALTER TABLE checkout_drafts ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Read-only trusted price/stock lookup for a single checkout line — used
-- by create-checkout-session to build the Stripe line item with a real
-- price (never trusts what the client sends) and to reject unavailable
-- items before creating the payment session. Same price hierarchy as
-- src/lib/precio.js / crear_venta_tpv. Service-role only: this doesn't
-- need to be callable by a browser client, the Edge Function calls it
-- with the service role key.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolver_linea_checkout(
  p_producto_id UUID, p_color_id TEXT, p_talla TEXT
)
RETURNS TABLE (
  producto_nombre TEXT,
  color_label TEXT,
  precio_unitario NUMERIC,
  stock_disponible INT,
  disponible BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_producto RECORD;
  v_color JSONB;
  v_color_tallas JSONB;
  v_precio_base NUMERIC;
BEGIN
  SELECT id, nombre, activo, precio, precio_oferta, precios_talla, tallas, colores
    INTO v_producto
    FROM productos
   WHERE id = p_producto_id;

  IF NOT FOUND OR NOT v_producto.activo THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::NUMERIC, 0, FALSE;
    RETURN;
  END IF;

  v_precio_base := COALESCE((v_producto.precios_talla ->> p_talla)::NUMERIC, v_producto.precio);
  IF v_producto.precio_oferta IS NOT NULL AND v_producto.precio_oferta < v_precio_base THEN
    v_precio_base := v_producto.precio_oferta;
  END IF;

  IF p_color_id IS NOT NULL THEN
    SELECT elem INTO v_color
      FROM jsonb_array_elements(COALESCE(v_producto.colores, '[]'::JSONB)) AS elem
     WHERE elem ->> 'id' = p_color_id
     LIMIT 1;

    IF v_color IS NULL THEN
      RETURN QUERY SELECT v_producto.nombre, NULL::TEXT, v_precio_base, 0, FALSE;
      RETURN;
    END IF;

    v_color_tallas := v_color -> 'tallas';
    IF jsonb_typeof(v_color_tallas) = 'object' THEN
      RETURN QUERY SELECT
        v_producto.nombre, COALESCE(v_color ->> 'label', v_color ->> 'id'), v_precio_base,
        COALESCE((v_color_tallas ->> p_talla)::INT, 0),
        COALESCE((v_color_tallas ->> p_talla)::INT, 0) > 0;
      RETURN;
    END IF;

    RETURN QUERY SELECT
      v_producto.nombre, COALESCE(v_color ->> 'label', v_color ->> 'id'), v_precio_base,
      COALESCE((v_producto.tallas ->> p_talla)::INT, 0),
      COALESCE((v_producto.tallas ->> p_talla)::INT, 0) > 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_producto.nombre, NULL::TEXT, v_precio_base,
    COALESCE((v_producto.tallas ->> p_talla)::INT, 0),
    COALESCE((v_producto.tallas ->> p_talla)::INT, 0) > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.resolver_linea_checkout(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolver_linea_checkout(UUID, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------
-- Creates a web order after Stripe confirms payment — called ONLY from
-- the stripe-webhook Edge Function (service role), never from the
-- browser. Same atomic FOR UPDATE stock logic as crear_venta_tpv,
-- duplicated on purpose rather than parametrized: two different trust
-- boundaries (one path is an authenticated admin at the counter, this
-- one is an unattended webhook after a real charge), matching why Alcosa
-- keeps create_order/create_paid_order/create_pos_sale as separate
-- functions instead of one with flags.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_venta_web(
  p_items JSONB, -- [{ "producto_id": "...", "color_id": "..."|null, "talla": "M", "cantidad": 2 }]
  p_cliente_nombre TEXT,
  p_cliente_email TEXT,
  p_cliente_telefono TEXT,
  p_cliente_direccion TEXT,
  p_stripe_session_id TEXT
)
RETURNS TABLE (venta_id UUID, numero_ticket INT, total NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_precio NUMERIC;
  v_using_color_stock BOOLEAN;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido no tiene productos';
  END IF;

  CREATE TEMP TABLE _venta_web_lines (
    producto_id UUID,
    producto_nombre TEXT,
    color_id TEXT,
    color_label TEXT,
    talla TEXT,
    cantidad INT,
    precio_unitario NUMERIC,
    origen_stock TEXT
  ) ON COMMIT DROP;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items)
      AS x(producto_id UUID, color_id TEXT, talla TEXT, cantidad INT)
  LOOP
    IF v_item.producto_id IS NULL OR v_item.talla IS NULL
       OR v_item.cantidad IS NULL OR v_item.cantidad <= 0 THEN
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

    INSERT INTO _venta_web_lines (producto_id, producto_nombre, color_id, color_label, talla, cantidad, precio_unitario, origen_stock)
    VALUES (v_item.producto_id, v_producto.nombre, v_item.color_id, v_color_label, v_item.talla, v_item.cantidad, v_precio,
            CASE WHEN v_using_color_stock THEN 'color' ELSE 'producto' END);
  END LOOP;

  INSERT INTO ventas (
    total, metodo_pago, canal, estado,
    cliente_nombre, cliente_email, cliente_telefono, cliente_direccion, stripe_session_id
  )
  VALUES (
    v_total, 'stripe', 'web', 'pendiente',
    p_cliente_nombre, p_cliente_email, p_cliente_telefono, p_cliente_direccion, p_stripe_session_id
  )
  RETURNING id, numero_ticket INTO v_venta_id, v_numero_ticket;

  INSERT INTO venta_items (venta_id, producto_id, producto_nombre, color_id, color_label, talla, cantidad, precio_unitario, origen_stock)
  SELECT venta_id, producto_id, producto_nombre, color_id, color_label, talla, cantidad, precio_unitario, origen_stock
    FROM (SELECT v_venta_id AS venta_id, * FROM _venta_web_lines) s;

  RETURN QUERY SELECT v_venta_id, v_numero_ticket, v_total;
END;
$$;

-- Not granted to anon/authenticated at all — only the service role
-- (stripe-webhook Edge Function, after verifying the Stripe signature and
-- confirming payment) may call this. A logged-out customer must never be
-- able to mark an order as paid without actually paying.
REVOKE ALL ON FUNCTION public.crear_venta_web(JSONB, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

-- ------------------------------------------------------------
-- Internal restock helper, shared by cancelar_venta() (admin, manual)
-- and expirar_ventas_pendientes() (pg_cron, automatic). Not exposed via
-- PostgREST at all — this project grants EXECUTE to anon/authenticated
-- by default on new public-schema functions, so every REVOKE below is
-- required, not just the from-PUBLIC one.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._restock_venta(p_venta_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  FOR v_item IN
    SELECT producto_id, color_id, talla, cantidad, origen_stock FROM venta_items WHERE venta_id = p_venta_id
  LOOP
    IF v_item.origen_stock = 'color' THEN
      UPDATE productos
         SET colores = (
           SELECT jsonb_agg(
             CASE WHEN elem ->> 'id' = v_item.color_id
                  THEN jsonb_set(
                         elem, ARRAY['tallas', v_item.talla],
                         to_jsonb(COALESCE((elem #>> ARRAY['tallas', v_item.talla])::INT, 0) + v_item.cantidad)
                       )
                  ELSE elem
             END
           )
           FROM jsonb_array_elements(productos.colores) AS elem
         )
       WHERE id = v_item.producto_id;
    ELSE
      UPDATE productos
         SET tallas = jsonb_set(
               COALESCE(tallas, '{}'::JSONB), ARRAY[v_item.talla],
               to_jsonb(COALESCE((tallas ->> v_item.talla)::INT, 0) + v_item.cantidad)
             )
       WHERE id = v_item.producto_id;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._restock_venta(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._restock_venta(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public._restock_venta(UUID) FROM authenticated;

-- ------------------------------------------------------------
-- Manual cancellation (admin, from /admin/pedidos) — idempotent, restores
-- stock via _restock_venta(). Same auth.uid() guard as crear_venta_tpv
-- (no profiles/roles table in this project — any authenticated session
-- is the shop's single admin account).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_venta(p_venta_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT estado INTO v_estado FROM ventas WHERE id = p_venta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;
  IF v_estado = 'cancelado' THEN
    RETURN;
  END IF;

  PERFORM public._restock_venta(p_venta_id);
  UPDATE ventas SET estado = 'cancelado' WHERE id = p_venta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_venta(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_venta(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cancelar_venta(UUID) FROM anon;

-- ------------------------------------------------------------
-- Auto-expiry sweep (new vs. Alcosa, which only cancels manually): web
-- orders left unfulfilled (not delivered, not cancelled) for 7 days get
-- cancelled and restocked automatically. Not callable via PostgREST —
-- only pg_cron (runs as the scheduling role, bypasses grants) invokes it.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expirar_ventas_pendientes()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venta RECORD;
  v_count INT := 0;
BEGIN
  FOR v_venta IN
    SELECT id FROM ventas
     WHERE canal = 'web'
       AND estado IN ('pendiente', 'preparando', 'listo')
       AND created_at < now() - interval '7 days'
     FOR UPDATE
  LOOP
    PERFORM public._restock_venta(v_venta.id);
    UPDATE ventas
       SET estado = 'cancelado',
           notas = trim(both ' ' from COALESCE(notas, '') || ' [Cancelado automáticamente: sin entregar tras 7 días]')
     WHERE id = v_venta.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expirar_ventas_pendientes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expirar_ventas_pendientes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.expirar_ventas_pendientes() FROM authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'expirar-ventas-pendientes',
  '0 3 * * *', -- daily at 03:00 UTC, off-hours for a Sevilla shop
  $$SELECT public.expirar_ventas_pendientes()$$
);

-- ------------------------------------------------------------
-- Admin read access to pedidos — same admin_all pattern as the rest of
-- this project, already covers `ventas`/`venta_items` from migration 010
-- (no new policy needed, the new columns are covered by the existing
-- `USING (true)` policy on the same tables).
-- ------------------------------------------------------------
