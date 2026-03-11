import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { calcTeamsTotal, getTierForAgents } from "../../../lib/pricing";

const BASE_PRICE = 10500;
const BASE_URL = process.env.NEXTAUTH_URL!;
const MP_TOKEN = process.env.MP_ACCESS_TOKEN!;

async function mp(path: string, method: string, body?: any) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MP_TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // Acepta llamadas internas con CRON_SECRET + ownerEmail en body
  const internalAuth = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  let email: string;

  if (internalAuth) {
    if (!req.body?.ownerEmail) return res.status(400).json({ error: "ownerEmail requerido" });
    email = req.body.ownerEmail;
  } else {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });
    email = session.user.email;
  }

  try {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("mp_plan_id, mp_subscription_id, team_id, team_role, plan")
      .eq("email", email)
      .single();

    if (sub?.team_role !== "owner") return res.status(403).json({ error: "Solo el broker" });
    if (!sub?.mp_subscription_id) return res.status(200).json({ ok: true, skipped: "sin suscripción activa" });

    // Contar agentes actuales (broker incluido)
    const { count } = await supabaseAdmin
      .from("subscriptions")
      .select("email", { count: "exact" })
      .eq("team_id", sub.team_id);

    const agentCount = count || 1;
    const newTotal = calcTeamsTotal(BASE_PRICE, agentCount);
    const tier = getTierForAgents(agentCount);

    // 1. Crear nuevo plan con precio actualizado
    const planBody = {
      reason: `InmoCoach — ${agentCount === 1 ? "Individual" : `Equipo ${agentCount} agentes (${tier.label})`}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: newTotal,
        currency_id: "ARS",
      },
      payment_methods_allowed: {
        payment_types: [{ id: "credit_card" }, { id: "debit_card" }],
      },
      back_url: `${BASE_URL}/pago/exito?plan=teams&agents=${agentCount}`,
      external_reference: `${email}|teams|${agentCount}`,
      notification_url: `${BASE_URL}/api/webhooks/mercadopago`,
    };

    const { ok: planOk, data: newPlan } = await mp("/preapproval_plan", "POST", planBody);
    if (!planOk || !newPlan.id) {
      console.error("Error creando nuevo plan MP:", newPlan);
      return res.status(500).json({ error: "Error al crear nuevo plan en MP" });
    }

    // 2. Migrar suscripción activa al nuevo plan
    const { ok: migrateOk, data: migrateData } = await mp(
      `/preapproval/${sub.mp_subscription_id}`,
      "PATCH",
      { preapproval_plan_id: newPlan.id }
    );

    if (!migrateOk) {
      console.error("Error migrando suscripción:", migrateData);
      // No es fatal — el plan nuevo está creado, se usará en el próximo checkout
    }

    // 3. Cancelar plan viejo si existe y es distinto
    if (sub.mp_plan_id && sub.mp_plan_id !== newPlan.id) {
      await mp(`/preapproval_plan/${sub.mp_plan_id}`, "PATCH", { status: "cancelled" });
    }

    // 4. Guardar nuevo plan ID en Supabase
    await supabaseAdmin
      .from("subscriptions")
      .update({ mp_plan_id: newPlan.id })
      .eq("email", email);

    console.log(`✅ Plan MP actualizado para ${email}: ${agentCount} agentes → $${newTotal}/mes (plan ${newPlan.id})`);
    return res.status(200).json({ ok: true, agentCount, newTotal, tier: tier.label, planId: newPlan.id });

  } catch (err: any) {
    console.error("Recalculate plan error:", err);
    return res.status(500).json({ error: err.message });
  }
}
