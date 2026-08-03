import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

// Renders an actual scannable CODE128 symbol (bars), not just the text —
// codes stored in productos.barcode / colores[].barcode are plain 12-digit
// strings (see src/lib/barcode.js), CODE128 encodes any digit string
// without needing an EAN-style check digit.
export const BarcodeImage = ({ value, height = 40, width = 1.6, fontSize = 11 }) => {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current || !value) return
    JsBarcode(svgRef.current, value, {
      format: 'CODE128',
      height,
      width,
      fontSize,
      margin: 4,
      displayValue: true,
    })
  }, [value, height, width, fontSize])

  return <svg ref={svgRef} />
}
