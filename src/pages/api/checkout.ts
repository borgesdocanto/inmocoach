import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { PLANS, PlanId } from "../../lib/plans";

// IDs de los planes compartidos en MercadoPago.
// Cada usuario se adhiere a estos planes — el precio se gestiona en UN solo lugar.
// Para cambiar el precio: PATCH /preapproval_plan/:id en MP + actualizar estas env vars.
const MP_PLAN_IDS: Partial<Record<PlanId, string | undefined>> = {
  individual: process.env.MP_PLAN_INDIVIDUAL_ID,
  teams: process.env.MP_PLAN_TEAMS_ID,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { planId } = req.body as { planId: PlanId };
  const plan = PLANS[planId];
  if (!plan || plan.price === 0) return res.status(400).json({ error: "Plan inválido" });

  const planMPId = MP_PLAN_IDS[planId];

  try {
    if (planMPId) {
      // ── Modo correcto: adherir al plan compartido ────────────────────────
      // El usuario se suscribe al plan existente — precio centralizado en MP
      const response = await fetch("https://api.mercadopago.com/preapproval", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          preapproval_plan_id: planMPId,
          payer_email: session.user.email,
          external_reference: `${session.user.email}|${planId}`,
          back_url: `${process.env.NEXTAUTH_URL}/pago/exito?plan=${planId}`,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.init_point) {
        console.error("MP preapproval error:", JSON.stringify(data));
        return res.status(500).json({ error: data.message || "Error al crear la suscripción" });
      }

      return res.status(200).json({ checkoutUrl: data.init_point });

    } else {
      // ── Fallback: crear plan individual (mientras no estén configurados los IDs) ──
      // ADVERTENCIA: este modo no permite cambio de precio centralizado.
      // Configurar MP_PLAN_INDIVIDUAL_ID y MP_PLAN_TEAMS_ID en Vercel para salir de este modo.
      console.warn(`[checkout] MP_PLAN_${planId.toUpperCase()}_ID no configurado — creando plan individual`);

      const response = await fetch("https://api.mercadopago.com/preapproval_plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          reason: `InstaCoach — Plan ${plan.name}`,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: plan.priceARS,
            currency_id: "ARS",
          },
          payment_methods_allowed: {
            payment_types: [{ id: "credit_card" }, { id: "debit_card" }],
          },
          back_url: `${process.env.NEXTAUTH_URL}/pago/exito?plan=${planId}`,
          external_reference: `${session.user.email}|${planId}`,
          notification_url: `${process.env.NEXTAUTH_URL}/api/webhooks/mercadopago`,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.init_point) {
        console.error("MP preapproval_plan error:", JSON.stringify(data));
        return res.status(500).json({ error: data.message || "Error al crear la suscripción" });
      }

      return res.status(200).json({ checkoutUrl: data.init_point });
    }

  } catch (err: any) {
    console.error("Checkout error:", err);
    return res.status(500).json({ error: "Error al procesar" });
  }
}
