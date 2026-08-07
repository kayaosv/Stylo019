INSERT INTO categorias (id, nombre, orden, activo)
VALUES ('venta_rapida', 'Venta rápida (TPV)', 99, false)
ON CONFLICT (id) DO NOTHING;
