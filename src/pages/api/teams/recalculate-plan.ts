import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { calcTeamsTotal, getTierForAgents } from "../../../lib/pricing";

const BASE_PRICE = 10500;
const BASE_URL = process.env.NEXTAUTH_URL!;
const MP_TOKEN = process.env.MP_ACCESS_TOKEN!;

// Recalcula y actualiza el plan de MP cuando cambia la cantidad de agentes
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = session.user.email;

  try {
    // Obtener datos del broker
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("mp_plan_id, mp_subscription_id, team_id, team_role, plan")
      .eq("email", email)
      .single();

    if (sub?.team_role !== "owner") return res.status(403).json({ error: "Solo el broker puede recalcular" });
    if (!sub?.mp_plan_id || !sub?.mp_subscription_id) return res.status(200).json({ ok: true, skipped: "sin suscripción activa" });

    // Contar agentes activos del equipo
    const { count } = await supabaseAdmin
      .from("subscriptions")
      .select("email", { count: "exact" })
      .eq("team_id", sub.team_id)
      .neq("email", email); // no contar al broker

    const agentCount = (count || 0) + 1; // +1 por el broker
    const newTotal = calcTeamsTotal(BASE_PRICE, agentCount);
    const tier = getTierForAgents(agentCount);

    // Actualizar plan en MP
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval_plan/${sub.mp_plan_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MP_TOKEN}` },
      body: JSON.stringify({
        reason: `InmoCoach — Equipo ${agentCount} agentes (${tier.label})`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: newTotal,
          currency_id: "ARS",
        },
        back_url: `${BASE_URL}/pago/exito?plan=teams&agents=${agentCount}`,
        external_reference: `${email}|teams|${agentCount}`,
        notification_url: `${BASE_URL}/api/webhooks/mercadopago`,
      }),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP recalculate error:", mpData);
      return res.status(500).json({ error: "Error al actualizar plan en MP" });
    }

    console.log(`✅ Plan MP actualizado para ${email}: ${agentCount} agentes → $${newTotal}/mes`);
    return res.status(200).json({ ok: true, agentCount, newTotal, tier: tier.label });

  } catch (err: any) {
    console.error("Recalculate plan error:", err);
    return res.status(500).json({ error: err.message });
  }
}
