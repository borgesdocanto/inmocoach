import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";
import { calcTeamsTotal, getTierForAgents } from "../../lib/pricing";

const BASE_PRICE = 10500;
const BASE_URL = process.env.NEXTAUTH_URL!;
const MP_TOKEN = process.env.MP_ACCESS_TOKEN!;

async function createOrUpdateMPPlan(
  email: string,
  agentCount: number,
  existingPlanId?: string
): Promise<{ planId: string; initPoint: string }> {
  const total = calcTeamsTotal(BASE_PRICE, agentCount);
  const tier = getTierForAgents(agentCount);
  const reason = agentCount === 1
    ? "InmoCoach — Plan Individual"
    : `InmoCoach — Equipo ${agentCount} agentes (${tier.label})`;

  const body = {
    reason,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: total,
      currency_id: "ARS",
    },
    payment_methods_allowed: {
      payment_types: [{ id: "credit_card" }, { id: "debit_card" }],
    },
    back_url: `${BASE_URL}/pago/exito?plan=teams&agents=${agentCount}`,
    external_reference: `${email}|teams|${agentCount}`,
    notification_url: `${BASE_URL}/api/webhooks/mercadopago`,
  };

  if (existingPlanId) {
    // PATCH — actualizar plan existente con nuevo precio
    const res = await fetch(`https://api.mercadopago.com/preapproval_plan/${existingPlanId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MP_TOKEN}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok && data.id) return { planId: data.id, initPoint: data.init_point };
  }

  // POST — crear nuevo plan
  const res = await fetch("https://api.mercadopago.com/preapproval_plan", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MP_TOKEN}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.init_point) {
    throw new Error(data.message || "Error al crear plan en MercadoPago");
  }
  return { planId: data.id, initPoint: data.init_point };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = session.user.email;
  const { agentCount = 1 } = req.body as { agentCount?: number };
  const count = Math.max(1, Number(agentCount));

  try {
    // Ver si ya tiene un plan MP guardado
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("mp_plan_id, mp_subscription_id")
      .eq("email", email)
      .single();

    const { planId, initPoint } = await createOrUpdateMPPlan(
      email,
      count,
      sub?.mp_plan_id || undefined
    );

    // Guardar el plan ID para futuras actualizaciones
    await supabaseAdmin
      .from("subscriptions")
      .update({ mp_plan_id: planId })
      .eq("email", email);

    const checkoutUrl = `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${planId}&payer_email=${encodeURIComponent(email)}&external_reference=${encodeURIComponent(`${email}|teams|${count}`)}`;

    return res.status(200).json({ checkoutUrl, planId, total: calcTeamsTotal(BASE_PRICE, count) });

  } catch (err: any) {
    console.error("Checkout error:", err);
    return res.status(500).json({ error: err.message || "Error al procesar" });
  }
}
