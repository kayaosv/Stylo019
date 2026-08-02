import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getPrecioEfectivo } from '@/lib/precio'

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      // `color` is the normalized color entry (from normalizeColores) the
      // customer had selected, or null for products without color variants.
      // Two items are the same line only if id + talla + color all match —
      // e.g. "Negro / M" and "Azul / M" stay as separate cart lines.
      addItem: (product, talla, color = null) => {
        const items = get().items
        const colorId = color?.id ?? null
        // Same fallback as tallasActivas in Producto.jsx: the color's own
        // stock map if it has one, else the product's base tallas. Stored
        // on the line so the quantity stepper can cap without needing a
        // live refetch — a snapshot, not guaranteed fresh forever, but
        // the checkout step re-validates against real stock regardless.
        const stockDisponible = Number((color?.tallas ?? product.tallas ?? {})[talla]) || 0
        const existing = items.find(
          (i) => i.id === product.id && i.talla === talla && (i.colorId ?? null) === colorId
        )

        if (existing) {
          set({
            items: items.map((i) =>
              i === existing
                ? { ...i, stockDisponible, cantidad: Math.max(1, Math.min(i.cantidad + 1, stockDisponible)) }
                : i
            ),
          })
        } else {
          const precioUnitario = getPrecioEfectivo(product, talla)
          set({
            items: [
              ...items,
              {
                ...product,
                talla,
                colorId,
                colorLabel: color?.label ?? null,
                colorImagen: color?.imagenes?.[0] ?? null,
                precioUnitario,
                stockDisponible,
                cantidad: 1,
              },
            ],
          })
        }
      },

      removeItem: (id, talla, colorId = null) =>
        set({
          items: get().items.filter(
            (i) => !(i.id === id && i.talla === talla && (i.colorId ?? null) === colorId)
          ),
        }),

      // stockDisponible is only set on items added after this change —
      // older persisted cart lines fall back to no cap (Infinity) rather
      // than getting silently stuck, since we don't know their real stock.
      updateCantidad: (id, talla, colorId, cantidad) => {
        if (cantidad <= 0) {
          get().removeItem(id, talla, colorId)
          return
        }
        set({
          items: get().items.map((i) => {
            if (i.id !== id || i.talla !== talla || (i.colorId ?? null) !== colorId) return i
            const max = i.stockDisponible ?? Infinity
            return { ...i, cantidad: Math.min(cantidad, max) }
          }),
        })
      },

      clearCart: () => set({ items: [] }),

      // Computed
      total: () =>
        get().items.reduce((sum, i) => {
          const price = i.precioUnitario ?? getPrecioEfectivo(i, i.talla)
          return sum + price * i.cantidad
        }, 0),

      totalItems: () =>
        get().items.reduce((sum, i) => sum + i.cantidad, 0),

      // WhatsApp message builder
      buildWhatsAppMessage: () => {
        const items = get().items
        if (items.length === 0) return ''

        const lines = items.map((i) => {
          const price = i.precioUnitario ?? getPrecioEfectivo(i, i.talla)
          const color = i.colorLabel ? ` (${i.colorLabel})` : ''
          return `• ${i.nombre}${color} — Talla: ${i.talla} x${i.cantidad} (€${(price * i.cantidad).toFixed(2)})`
        })

        const total = get().total()
        const msg = [
          'Hola! Me gustaría hacer un pedido:',
          '',
          ...lines,
          '',
          `Total: €${total.toFixed(2)}`,
          '',
          '¿Podéis confirmar disponibilidad?',
        ].join('\n')

        return encodeURIComponent(msg)
      },
    }),
    {
      name: 'mmj-cart',
      version: 1,
    }
  )
)
