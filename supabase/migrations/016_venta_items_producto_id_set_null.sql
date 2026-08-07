-- Allow deleting a producto even if it has sale history. venta_items already
-- stores producto_nombre/color_label/talla/precio_unitario denormalized, so
-- the sale record stays intact and readable — only the FK link is dropped.
ALTER TABLE venta_items ALTER COLUMN producto_id DROP NOT NULL;

ALTER TABLE venta_items DROP CONSTRAINT venta_items_producto_id_fkey;

ALTER TABLE venta_items
  ADD CONSTRAINT venta_items_producto_id_fkey
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL;
