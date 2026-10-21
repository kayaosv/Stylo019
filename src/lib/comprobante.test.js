import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  comprobanteLineas,
  comprobanteTexto,
  whatsappUrl,
  generarComprobantePng,
  enviarComprobanteWhatsApp,
  descargarComprobante,
} from '@/lib/comprobante'

const pedido = (extra = {}) => ({
  numero_ticket: 67,
  total: 38.4,
  creado_el: '2026-10-21T10:30:00.000Z',
  expira_el: '2026-10-28T10:30:00.000Z',
  cliente_nombre: 'María José',
  cliente_telefono: '+34638970807',
  lineas: [
    { producto_nombre: 'Falda Ibiza', color_label: 'Negro', talla: 'M', cantidad: 1, precio_unitario: 25.9 },
    { producto_nombre: 'Bolso canalé', color_label: null, talla: 'Única', cantidad: 1, precio_unitario: 12.5 },
  ],
  ...extra,
})

describe('comprobanteTexto', () => {
  it('incluye número de pedido, método de pago, líneas, total, validez y dirección', () => {
    const texto = comprobanteTexto(pedido())
    expect(texto).toContain('Reserva #67')
    expect(texto).toContain('Método de pago: recogida y pago en tienda')
    expect(texto).toContain('pendiente de pago')
    expect(texto).toContain('Falda Ibiza (Negro)')
    expect(texto).toContain('Talla M')
    expect(texto).toContain('Bolso canalé')
    expect(texto).toContain('€25.90')
    expect(texto).toContain('Total: €38.40')
    expect(texto).toContain('28/10/2026')
    expect(texto).toContain('Calle Ciudad de Carlet, 10, Local 2')
    expect(texto).toContain('María José')
    expect(texto).toContain('+34 638 970 807')
  })

  it('no inventa color cuando la línea no tiene', () => {
    expect(comprobanteTexto(pedido())).not.toContain('(null)')
  })
})

describe('whatsappUrl', () => {
  it('apunta al WhatsApp de la tienda y lleva el comprobante codificado', () => {
    const url = whatsappUrl(pedido())
    expect(url.startsWith('https://wa.me/34638970807?text=')).toBe(true)
    const texto = decodeURIComponent(url.split('?text=')[1])
    expect(texto).toBe(comprobanteTexto(pedido()))
  })

  it('codifica caracteres que podrían alterar la URL', () => {
    const url = whatsappUrl(pedido({ cliente_nombre: 'Ana&text=EVIL#frag?x=1' }))
    expect(url.split('?').length).toBe(2)
    expect(url).not.toContain('#')
    expect(url.split('&')).toHaveLength(1)
  })
})

describe('comprobanteLineas', () => {
  it('describe cada línea con su importe total', () => {
    const items = comprobanteLineas(pedido()).filter((l) => l.tipo === 'item')
    expect(items).toHaveLength(2)
    expect(items[0].importe).toBe('€25.90')
  })
})

const ctxFalso = () => {
  const textos = []
  return {
    textos,
    ctx: {
      fillText: (t) => textos.push(t),
      measureText: (t) => ({ width: t.length * 8 }),
      fillRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      scale: () => {},
      setLineDash: () => {},
    },
  }
}

describe('generarComprobantePng', () => {
  afterEach(() => vi.restoreAllMocks())

  it('dibuja el comprobante en un canvas y devuelve un PNG', async () => {
    const { ctx, textos } = ctxFalso()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, tipo) =>
      cb(new Blob(['png'], { type: tipo })),
    )

    const blob = await generarComprobantePng(pedido())

    expect(blob.type).toBe('image/png')
    const dibujado = textos.join('\n')
    expect(dibujado).toContain('Reserva #67')
    expect(dibujado).toContain('Falda Ibiza')
    expect(dibujado).toContain('€38.40')
  })

  it('falla con un error claro si el navegador no puede generar la imagen', async () => {
    const { ctx } = ctxFalso()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(null))
    await expect(generarComprobantePng(pedido())).rejects.toThrow('comprobante')
  })
})

describe('enviar por WhatsApp y descargar', () => {
  const prepararCanvas = () => {
    const { ctx } = ctxFalso()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, tipo) =>
      cb(new Blob(['png'], { type: tipo })),
    )
    URL.createObjectURL = vi.fn(() => 'blob:falso')
    URL.revokeObjectURL = vi.fn()
  }
  const quitarShare = () => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
  }

  afterEach(() => {
    vi.restoreAllMocks()
    quitarShare()
  })

  it('enviarComprobanteWhatsApp abre directamente el chat del número 807 con el texto', () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null)
    const share = vi.fn()
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })

    enviarComprobanteWhatsApp(pedido())

    expect(abrir).toHaveBeenCalledWith(whatsappUrl(pedido()), '_blank', 'noopener,noreferrer')
    expect(whatsappUrl(pedido())).toMatch(/^https:\/\/wa\.me\/34638970807\?text=/)
    expect(share).not.toHaveBeenCalled()
  })

  it('descargarComprobante solo descarga, sin abrir WhatsApp', async () => {
    prepararCanvas()
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null)
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await descargarComprobante(pedido())

    expect(clic).toHaveBeenCalledTimes(1)
    expect(abrir).not.toHaveBeenCalled()
  })
})
