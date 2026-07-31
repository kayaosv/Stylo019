-- Azul/Marron/Beige/Gris dejan de ser colores de catalogo fijo (solo
-- Blanco+Negro siguen fijos) y pasan a ser libres/personalizados.
-- Hasta ahora se resolvian por id via COLORES_DISPONIBLES en el
-- codigo, sin llevar label/hex propio en el JSON guardado -- si se
-- sacan del catalogo fijo sin esto, esas entradas quedan sin nombre
-- ni color real (normalizeColores() ya no las reconoceria). Se les
-- backfillea label+hex explicito para que queden autosuficientes,
-- igual que un color personalizado cualquiera. No toca nada mas del
-- objeto (imagenes, tallas, barcode se preservan tal cual).
--
-- Aplicada ya en produccion via MCP el 2026-07-31, verificada con
-- una consulta real (0 entradas sin hex tras el update) antes de
-- committear este archivo.
UPDATE productos p
SET colores = (
  SELECT jsonb_agg(
    CASE elem ->> 'id'
      WHEN 'azul'   THEN elem || jsonb_build_object('label', 'Azul',   'hex', '#2b4a7a')
      WHEN 'marron' THEN elem || jsonb_build_object('label', 'Marrón', 'hex', '#6b4423')
      WHEN 'beige'  THEN elem || jsonb_build_object('label', 'Beige',  'hex', '#d9c9a8', 'border', true)
      WHEN 'gris'   THEN elem || jsonb_build_object('label', 'Gris',   'hex', '#8a8a8a')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(p.colores) elem
)
WHERE p.colores IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p.colores) c2
    WHERE c2 ->> 'id' IN ('azul', 'marron', 'beige', 'gris')
  );
