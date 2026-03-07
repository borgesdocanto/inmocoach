import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { PLANS, PlanId } from "../../lib/plans";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { planId } = req.body as { planId: PlanId };
  const plan = PLANS[planId];
  if (!plan || plan.price === 0) return res.status(400).json({ error: "Plan inválido" });

  const baseUrl = process.env.NEXTAUTH_URL;

  try {
    // Crear preapproval_plan (suscripción automática mensual)
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
        back_url: `${baseUrl}/pago/exito?plan=${planId}`,
        external_reference: `${session.user.email}|${planId}`,
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.init_point) {
      console.error("MP preapproval error:", JSON.stringify(data));
      return res.status(500).json({ error: data.message || "Error al crear la suscripción" });
    }

    return res.status(200).json({ checkoutUrl: data.init_point });
  } catch (err: any) {
    console.error("Checkout error:", err);
    return res.status(500).json({ error: "Error al procesar" });
  }
}
