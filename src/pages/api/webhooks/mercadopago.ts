import { NextApiRequest, NextApiResponse } from "next";
import { upgradePlan } from "../../../lib/subscription";
import { supabaseAdmin } from "../../../lib/supabase";
import { PlanId } from "../../../lib/plans";
import { getOrCreateTeam } from "../../../lib/teams";

async function getMPData(url: string) {
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });
  return res.json();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { type, data } = req.body;
  if (!type || !data?.id) return res.status(200).json({ ok: true });

  try {
    // ── Pago individual (legacy o cobro mensual automático) ───────────────────
    if (type === "payment") {
      const payment = await getMPData(`https://api.mercadopago.com/v1/payments/${data.id}`);
      if (payment.status !== "approved") return res.status(200).json({ ok: true });

      const [email, planId] = (payment.external_reference ?? "").split("|");
      if (!email || !planId) return res.status(200).json({ ok: true });

      await activatePlan(email, planId as PlanId, String(payment.id), String(payment.payer?.id ?? ""), payment);
      return res.status(200).json({ ok: true });
    }

    // ── Suscripción autorizada / renovada ─────────────────────────────────────
    if (type === "subscription_preapproval") {
      const sub = await getMPData(`https://api.mercadopago.com/preapproval/${data.id}`);

      if (!["authorized", "active"].includes(sub.status)) {
        // Suscripción cancelada o suspendida — bajar plan a free
        if (sub.status === "cancelled" || sub.status === "paused") {
          const [email] = (sub.external_reference ?? "").split("|");
          if (email) {
            await supabaseAdmin
              .from("subscriptions")
              .update({ plan: "free", status: "cancelled", mp_subscription_id: null })
              .eq("email", email);
          }
        }
        return res.status(200).json({ ok: true });
      }

      const [email, planId] = (sub.external_reference ?? "").split("|");
      if (!email || !planId) return res.status(200).json({ ok: true });

      await activatePlan(email, planId as PlanId, String(sub.id), String(sub.payer_id ?? ""), sub);
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}

async function activatePlan(
  email: string,
  planId: PlanId,
  mpId: string,
  mpPayerId: string,
  mpData: any
) {
  await upgradePlan(email, planId, mpId, mpPayerId);

  // Si compró Teams → owner + equipo automático
  if (planId === "teams") {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("name, team_role")
      .eq("email", email)
      .single();

    // Solo crear equipo si no es ya owner
    if (sub?.team_role !== "owner") {
      const brokerName = sub?.name || email.split("@")[0];
      const team = await getOrCreateTeam(email, `Equipo de ${brokerName}`);
      await supabaseAdmin
        .from("subscriptions")
        .update({ team_id: team.id, team_role: "owner" })
        .eq("email", email);
    }
  }

  // Registrar pago
  await supabaseAdmin.from("payments").insert({
    email,
    mp_payment_id: mpId,
    plan: planId,
    amount: mpData.transaction_amount || mpData.auto_recurring?.transaction_amount || 0,
    currency: mpData.currency_id || mpData.auto_recurring?.currency_id || "ARS",
    status: "approved",
  });
}
