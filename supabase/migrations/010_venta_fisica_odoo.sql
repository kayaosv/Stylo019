-- ============================================================
-- ModaMariaJose — Physical store sale (TPV) + Odoo invoicing
-- Run this in Supabase Dashboard > SQL Editor (or via MCP apply_migration)
-- ============================================================
-- Mirrors the pattern already proven on Vapers Alcosa's own TPV: stock and
-- catalog stay 100% in this database (Odoo is never the source of truth for
-- inventory), the sale always confirms and decrements stock even if Odoo is
-- down or not configured yet — invoicing happens afterwards, decoupled, via
-- the odoo-sync Edge Function (see odoo_sync_status below).
--
-- Unlike Alcosa, this project has no `product_variants` table — colors live
-- as a jsonb array on `productos.colores`, each optionally carrying its own
-- `tallas` stock map (see migration 009_stock_por_color.sql). So "variant"
-- here means a color, identified by its `id` string, not a separate row.

-- ------------------------------------------------------------
-- Barcode support — one per product (fallback / no-colors case) and
-- optionally one per color, stored as `colores[i].barcode` (no schema-level
-- uniqueness possible on a jsonb array element; enforced app-side by
-- src/lib/barcode.js retrying against buscar_por_barcode()).
-- ------------------------------------------------------------
ALTER TABLE productos ADD COLUMN IF NOT EXISTS barcode TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS productos_barcode_key ON productos (barcode) WHERE barcode IS NOT NULL;

-- ------------------------------------------------------------
-- Sale header + lines. Split in two tables (not the single flat `ventas`
-- row-per-line originally sketched in CLAUDE.md) so a whole sale maps to
-- one Odoo invoice with multiple lines, same shape as Alcosa's
-- orders/order_items.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_ticket SERIAL,
  total NUMERIC NOT NULL,
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'tarjeta')),
  canal TEXT NOT NULL DEFAULT 'tienda' CHECK (canal IN ('tienda', 'web')),
  odoo_sync_status TEXT NOT NULL DEFAULT 'pending',
  odoo_invoice_id TEXT,
  odoo_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN ventas.odoo_sync_status IS '''pending'' (not attempted yet), ''synced'' (invoice created in Odoo), ''error'' (sync failed, see odoo_sync_error).';

CREATE TABLE IF NOT EXISTS venta_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  producto_nombre TEXT NOT NULL,
  color_id TEXT,
  color_label TEXT,
  talla TEXT NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario NUMERIC NOT NULL
);

CREATE INDEX IF NOT EXISTS venta_items_venta_id_idx ON venta_items (venta_id);

ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_items ENABLE ROW LEVEL SECURITY;

-- Same posture as `productos`: any authenticated session is the shop's
-- single admin account, no public/customer access to sale records at all.
CREATE POLICY admin_all ON ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY admin_all ON venta_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- Barcode lookup — checks the base product barcode first, then scans each
-- color entry. Used both by the TPV scanner and by the barcode generator's
-- collision check (src/lib/barcode.js).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buscar_por_barcode(p_barcode TEXT)
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
  color_tallas JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT p.id, p.nombre, p.precio, p.precio_oferta, p.precios_talla, p.tallas, p.activo,
           NULL::TEXT, NULL::TEXT, NULL::JSONB
      FROM productos p
     WHERE p.barcode = p_barcode
     LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT p.id, p.nombre, p.precio, p.precio_oferta, p.precios_talla, p.tallas, p.activo,
           c ->> 'id', COALESCE(c ->> 'label', c ->> 'id'), c -> 'tallas'
      FROM productos p, jsonb_array_elements(COALESCE(p.colores, '[]'::JSONB)) AS c
     WHERE c ->> 'barcode' = p_barcode
     LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.buscar_por_barcode(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_por_barcode(TEXT) TO authenticated;
-- This project's default privileges grant EXECUTE directly to anon/authenticated
-- on new public-schema functions (confirmed the hard way on Alcosa) — the
-- REVOKE ALL FROM PUBLIC above doesn't reach that, so revoke anon explicitly.
REVOKE EXECUTE ON FUNCTION public.buscar_por_barcode(TEXT) FROM anon;

-- ------------------------------------------------------------
-- Physical sale, atomic — same FOR UPDATE row-lock pattern as
-- create_pos_sale() on Alcosa, adapted to this project's jsonb stock model
-- (productos.tallas or, when a color carries its own map, colores[i].tallas)
-- instead of a product_variants table.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_venta_tpv(
  p_items JSONB, -- [{ "producto_id": "...", "color_id": "..."|null, "talla": "M", "cantidad": 2 }]
  p_metodo_pago TEXT -- 'efectivo' | 'tarjeta'
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
    precio_unitario NUMERIC
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

    -- Same price hierarchy as src/lib/precio.js: precios_talla[talla] ->
    -- precio (base), then precio_oferta applies on top when it's lower.
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

      -- trg_sync_tallas_disponibles (migration 009) recomputes the
      -- product-level aggregate automatically from this update.
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

    INSERT INTO _venta_lines (producto_id, producto_nombre, color_id, color_label, talla, cantidad, precio_unitario)
    VALUES (v_item.producto_id, v_producto.nombre, v_item.color_id, v_color_label, v_item.talla, v_item.cantidad, v_precio);
  END LOOP;

  INSERT INTO ventas (total, metodo_pago, canal)
  VALUES (v_total, p_metodo_pago, 'tienda')
  RETURNING id, numero_ticket INTO v_venta_id, v_numero_ticket;

  INSERT INTO venta_items (venta_id, producto_id, producto_nombre, color_id, color_label, talla, cantidad, precio_unitario)
  SELECT v_venta_id, producto_id, producto_nombre, color_id, color_label, talla, cantidad, precio_unitario
    FROM _venta_lines;

  RETURN QUERY SELECT v_venta_id, v_numero_ticket, v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_venta_tpv(JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_venta_tpv(JSONB, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.crear_venta_tpv(JSONB, TEXT) FROM anon;
