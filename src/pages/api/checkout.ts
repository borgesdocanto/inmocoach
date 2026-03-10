import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";
import { calcTeamsTotal, getTierForAgents } from "../../lib/pricing";

const BASE_PRICE = 10500;
const BASE_URL = process.env.NEXTAUTH_URL!;
const MP_TOKEN = process.env.MP_ACCESS_TOKEN!;

async function mp(path: string, method: string, body?: any) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MP_TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) console.error(`MP ${method} ${path} error:`, JSON.stringify(data));
  return { ok: res.ok, data };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = session.user.email;
  const { agentCount = 1 } = req.body as { agentCount?: number };
  const count = Math.max(1, Number(agentCount));
  const total = calcTeamsTotal(BASE_PRICE, count);
  const tier = getTierForAgents(count);

  try {
    // PASO 1: Crear preapproval_plan (plantilla del plan)
    const { ok: planOk, data: plan } = await mp("/preapproval_plan", "POST", {
      reason: count === 1
        ? "InmoCoach — Plan Individual"
        : `InmoCoach — Equipo ${count} agentes (${tier.label})`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: total,
        currency_id: "ARS",
      },
      payment_methods_allowed: {
        payment_types: [{ id: "credit_card" }, { id: "debit_card" }],
      },
      back_url: `${BASE_URL}/pago/exito?plan=teams&agents=${count}`,
      notification_url: `${BASE_URL}/api/webhooks/mercadopago`,
    });

    if (!planOk || !plan.id) {
      return res.status(500).json({ error: plan.message || "Error al crear plan en MP" });
    }

    // PASO 2: Crear preapproval (suscripción) a partir del plan — esto genera el init_point real
    const { ok: subOk, data: sub } = await mp("/preapproval", "POST", {
      preapproval_plan_id: plan.id,
      payer_email: email,
      reason: count === 1
        ? "InmoCoach — Plan Individual"
        : `InmoCoach — Equipo ${count} agentes (${tier.label})`,
      external_reference: `${email}|teams|${count}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: total,
        currency_id: "ARS",
      },
      back_url: `${BASE_URL}/pago/exito?plan=teams&agents=${count}`,
      notification_url: `${BASE_URL}/api/webhooks/mercadopago`,
    });

    if (!subOk || !sub.init_point) {
      return res.status(500).json({ error: sub.message || "Error al crear suscripción en MP" });
    }

    // Guardar mp_plan_id para poder recalcular después
    await supabaseAdmin
      .from("subscriptions")
      .update({ mp_plan_id: plan.id })
      .eq("email", email);

    console.log(`✅ Checkout creado para ${email}: ${count} agentes → $${total}/mes → ${sub.init_point}`);
    return res.status(200).json({ checkoutUrl: sub.init_point, planId: plan.id, total });

  } catch (err: any) {
    console.error("Checkout error:", err);
    return res.status(500).json({ error: err.message || "Error al procesar" });
  }
}
