-- ============================================================
-- ModaMariaJose — Registro de etiquetas de codigo de barras impresas
-- ============================================================
-- El stock fisico no trae etiqueta con codigo de barra (se compra suelto),
-- y `productos.barcode` / `colores[].barcode` se generan solos en cuanto se
-- sube stock (ver src/lib/barcode.js + ProductoForm.jsx), pero eso no dice
-- si esa etiqueta ya se imprimio y se pego en la prenda fisica.
--
-- En vez de guardar un flag `impreso` dentro de `colores[]` (requeriria
-- mutar el jsonb con jsonb_set cada vez, mismo patron que ya usa
-- crear_venta_tpv para descontar stock), se usa una tabla de registro
-- aparte, con el propio codigo de barras como clave: si un codigo se
-- regenera despues (boton "Generar" de nuevo sobre un color), el codigo
-- viejo deja de existir en `productos`/`colores` y el nuevo cuenta como
-- pendiente automaticamente, sin logica extra para "resetear" ningun flag.

CREATE TABLE IF NOT EXISTS etiquetas_impresas (
  barcode TEXT PRIMARY KEY,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  producto_nombre TEXT NOT NULL,
  color_id TEXT,
  color_label TEXT,
  printed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE etiquetas_impresas ENABLE ROW LEVEL SECURITY;

-- Same posture as `productos`/`ventas`: single admin account, no public access.
CREATE POLICY admin_all ON etiquetas_impresas FOR ALL TO authenticated USING (true) WITH CHECK (true);
