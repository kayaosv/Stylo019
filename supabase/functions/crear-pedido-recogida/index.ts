import { createClient } from 'npm:@supabase/supabase-js@2'
import { manejar, type RespuestaRpc } from './handler.ts'

// Only door to crear_pedido_recogida(): the SQL function is executable by
// service_role alone. Customers are anonymous, so verify_jwt stays off and
// the protections live in validacion.ts, handler.ts and the SQL function.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

const ADMIN_EMAIL = 'modastylo019@gmail.com'

Deno.serve((req) =>
  manejar(req, {
    salt: Deno.env.get('RATE_LIMIT_SALT') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,

    crearPedido: async ({ items, nombre, telefono, email, notas, ipHash, requestId }) => {
      const { data, error } = await supabase.rpc('crear_pedido_recogida', {
        p_items: items.map(({ producto_id, color_id, talla, cantidad }) => ({
          producto_id,
          color_id,
          talla,
          cantidad,
        })),
        p_nombre: nombre,
        p_telefono: telefono,
        p_email: email,
        p_notas: notas,
        p_ip_hash: ipHash,
        p_idempotency_key: requestId,
      })
      if (error) throw error
      return data as RespuestaRpc
    },

    enviarEmail: async (asunto, html) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('RESEND_FROM_EMAIL'),
          to: [ADMIN_EMAIL],
          subject: asunto,
          html,
        }),
      })
      if (!res.ok) throw new Error(`Resend respondió ${res.status}`)
    },
  })
)
