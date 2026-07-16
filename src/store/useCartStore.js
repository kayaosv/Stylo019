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
        const existing = items.find(
          (i) => i.id === product.id && i.talla === talla && (i.colorId ?? null) === colorId
        )

        if (existing) {
          set({
            items: items.map((i) =>
              i === existing ? { ...i, cantidad: i.cantidad + 1 } : i
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

      updateCantidad: (id, talla, colorId, cantidad) => {
        if (cantidad <= 0) {
          get().removeItem(id, talla, colorId)
          return
        }
        set({
          items: get().items.map((i) =>
            i.id === id && i.talla === talla && (i.colorId ?? null) === colorId
              ? { ...i, cantidad }
              : i
          ),
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
