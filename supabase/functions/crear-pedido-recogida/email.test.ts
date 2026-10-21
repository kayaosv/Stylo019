// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { escaparHtml, construirEmailAdmin } from './email.ts'

const pedido = (extra = {}) => ({
  numero_ticket: 67,
  total: 25.9,
  creado_el: '2026-10-21T10:30:00.000Z',
  expira_el: '2026-10-28T10:30:00.000Z',
  cliente_nombre: 'María José',
  cliente_telefono: '+34638970807',
  cliente_email: 'maria@example.com',
  notas: 'Paso por la tarde',
  lineas: [
    { producto_nombre: 'Falda Ibiza', color_label: 'Negro', talla: 'M', cantidad: 1, precio_unitario: 25.9 },
  ],
  ...extra,
})

describe('escaparHtml', () => {
  it('escapa los cinco caracteres peligrosos', () => {
    expect(escaparHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    )
  })

  it('devuelve cadena vacía para null y undefined', () => {
    expect(escaparHtml(null)).toBe('')
    expect(escaparHtml(undefined)).toBe('')
  })

  it('convierte números a texto', () => {
    expect(escaparHtml(42)).toBe('42')
  })
})

describe('construirEmailAdmin', () => {
  it('incluye número de pedido, cliente, teléfono, líneas, total y validez', () => {
    const { asunto, html } = construirEmailAdmin(pedido())
    expect(asunto).toContain('#67')
    expect(html).toContain('María José')
    expect(html).toContain('+34638970807')
    expect(html).toContain('Falda Ibiza')
    expect(html).toContain('€25.90')
    expect(html).toContain('Pendiente de cobro')
    expect(html).toContain('28/10/2026')
  })

  it('enlaza al admin y al WhatsApp de la clienta', () => {
    const { html } = construirEmailAdmin(pedido())
    expect(html).toContain('/admin/pedidos')
    expect(html).toContain('https://wa.me/34638970807')
  })

  it('escapa todo texto del usuario: nunca aparece HTML ejecutable', () => {
    const hostil = '<img src=x onerror=alert(1)><script>alert(2)</script>"\'&'
    const { html, asunto } = construirEmailAdmin(
      pedido({
        cliente_nombre: hostil,
        cliente_email: hostil,
        notas: hostil,
        lineas: [{ producto_nombre: hostil, color_label: hostil, talla: hostil, cantidad: 1, precio_unitario: 1 }],
      }),
    )

    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('onerror=alert(1)>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(asunto).not.toMatch(/[<>]/)
  })

  it('un teléfono con caracteres raros no rompe el enlace de WhatsApp', () => {
    const { html } = construirEmailAdmin(pedido({ cliente_telefono: '+34"><script>' }))
    expect(html).not.toContain('"><script>')
    expect(html).toContain('https://wa.me/34')
  })

  it('funciona sin email, sin notas y sin color', () => {
    const { html } = construirEmailAdmin(
      pedido({
        cliente_email: null,
        notas: null,
        lineas: [{ producto_nombre: 'Bolso', color_label: null, talla: 'Única', cantidad: 2, precio_unitario: 12 }],
      }),
    )
    expect(html).toContain('Bolso')
    expect(html).toContain('€24.00')
  })
})
