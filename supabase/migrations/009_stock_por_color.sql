-- ============================================================
-- ModaMariaJose — Stock por color + talla
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- `tipo_talla` and `tallas_disponibles` already exist in production (added by
-- an earlier undocumented change) — guarded here so this file is replayable
-- on a fresh database.
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS tipo_talla TEXT NOT NULL DEFAULT 'ropa';

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS tallas_disponibles TEXT[];

-- ------------------------------------------------------------
-- Each entry in `colores` may now carry its own `tallas` map, same shape as
-- the product-level one:
--   { "id": "negro", "imagenes": [...], "tallas": {"S":2,"M":0,...} }
--
-- Products where no color entry has `tallas` are unaffected — `productos.tallas`
-- keeps working as the manually-edited global stock, exactly as before. This
-- is an opt-in, per-product migration: existing products keep their current
-- behavior until someone fills in per-color stock for them in the admin.
--
-- When at least one color DOES carry `tallas`, `productos.tallas` is recomputed
-- here as the sum across all colors for each size — ignoring whatever value
-- was sent directly for `tallas` — so every existing reader of `producto.tallas`
-- (sold-out banner, catalog size filter via `tallas_disponibles`) keeps working
-- without changes.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_tallas_disponibles()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  color jsonb;
  color_tallas jsonb;
  has_color_stock boolean := false;
  agregadas jsonb := '{}'::jsonb;
  k text;
  v numeric;
BEGIN
  IF jsonb_typeof(NEW.colores) = 'array' THEN
    FOR color IN SELECT * FROM jsonb_array_elements(NEW.colores)
    LOOP
      color_tallas := color -> 'tallas';
      IF jsonb_typeof(color_tallas) = 'object' THEN
        has_color_stock := true;
        FOR k, v IN
          SELECT key, (value::text)::numeric
          FROM jsonb_each(color_tallas)
          WHERE jsonb_typeof(value) = 'number'
        LOOP
          agregadas := jsonb_set(
            agregadas, ARRAY[k],
            to_jsonb(COALESCE((agregadas ->> k)::numeric, 0) + v)
          );
        END LOOP;
      END IF;
    END LOOP;

    IF has_color_stock THEN
      NEW.tallas := agregadas;
    END IF;
  END IF;

  NEW.tallas_disponibles := ARRAY(
    SELECT key FROM jsonb_each(NEW.tallas)
    WHERE jsonb_typeof(value) = 'number'
      AND (value::text)::int > 0
  );
  RETURN NEW;
END;
$function$;

-- Recreate the trigger so it also fires when only `colores` changes
-- (previously scoped to `UPDATE OF tallas`, which could miss color-only
-- stock edits in future code paths).
DROP TRIGGER IF EXISTS trg_sync_tallas_disponibles ON public.productos;
CREATE TRIGGER trg_sync_tallas_disponibles
  BEFORE INSERT OR UPDATE OF tallas, colores ON public.productos
  FOR EACH ROW EXECUTE FUNCTION sync_tallas_disponibles();
