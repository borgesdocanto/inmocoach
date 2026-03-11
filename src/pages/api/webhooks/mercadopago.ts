import { NextApiRequest, NextApiResponse } from "next";
import { upgradePlan } from "../../../lib/subscription";
import { supabaseAdmin } from "../../../lib/supabase";
import { PlanId } from "../../../lib/plans";
import { getOrCreateTeam } from "../../../lib/teams";
import { applyPendingUpgrade } from "../../../lib/teamsSubscription";

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

      const [email, planId, agentCountStrP] = (payment.external_reference ?? "").split("|");
      const agentCountP = parseInt(agentCountStrP || "1", 10);
      if (!email || !planId) return res.status(200).json({ ok: true });

      await activatePlan(email, planId as PlanId, String(payment.id), String(payment.payer?.id ?? ""), payment, agentCountP);
      return res.status(200).json({ ok: true });
    }

    // ── Suscripción autorizada / renovada ─────────────────────────────────────
    if (type === "subscription_preapproval") {
      const sub = await getMPData(`https://api.mercadopago.com/preapproval/${data.id}`);

      if (!["authorized", "active"].includes(sub.status)) {
        if (sub.status === "cancelled" || sub.status === "paused") {
          const [email] = (sub.external_reference ?? "").split("|");
          if (email) {
            // Obtener paid_until desde el próximo cobro o current_period_end de MP
            const paidUntil = sub.next_payment_date || sub.date_last_updated
              ? new Date(sub.next_payment_date || sub.date_last_updated)
              : new Date();

            const { data: brokerSub } = await supabaseAdmin
              .from("subscriptions")
              .select("team_id, team_role")
              .eq("email", email)
              .single();

            // Si es broker de un equipo, pausar el equipo con fecha de corte
            if (brokerSub?.team_id && brokerSub.team_role === "owner") {
              await supabaseAdmin
                .from("teams")
                .update({ status: "paused", paid_until: paidUntil.toISOString() })
                .eq("id", brokerSub.team_id);
            }

            await supabaseAdmin
              .from("subscriptions")
              .update({ plan: "free", status: "cancelled", mp_subscription_id: null })
              .eq("email", email);
          }
        }
        return res.status(200).json({ ok: true });
      }

      let [email, planId, agentCountStr] = (sub.external_reference ?? "").split("|");
      const agentCount = parseInt(agentCountStr || "1", 10);

      // Fallback: si no hay external_reference, buscar por payer email en Supabase
      if (!email && sub.payer_id) {
        const { data: found } = await supabaseAdmin
          .from("subscriptions")
          .select("email, plan")
          .eq("mp_payer_id", String(sub.payer_id))
          .single();
        if (found) email = found.email;
      }

      // Determinar planId desde el preapproval_plan_id si no viene en external_reference
      if (!planId && sub.preapproval_plan_id) {
        if (sub.preapproval_plan_id === process.env.MP_PLAN_INDIVIDUAL_ID) planId = "individual";
        if (sub.preapproval_plan_id === process.env.MP_PLAN_TEAMS_ID) planId = "teams";
      }

      if (!email || !planId) {
        console.warn("Webhook: no se pudo identificar email o planId", { external_reference: sub.external_reference, payer_id: sub.payer_id });
        return res.status(200).json({ ok: true });
      }

      await activatePlan(email, planId as PlanId, String(sub.id), String(sub.payer_id ?? ""), sub, agentCount);

      // Si hay agentes extra pendientes de cobrar, aplicar el upgrade ahora
      await applyPendingUpgrade(email).catch(e => console.error("applyPendingUpgrade error:", e));

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
  mpData: any,
  agentCount: number = 1
) {
  await upgradePlan(email, planId, mpId, mpPayerId);

  // Si compró Teams → owner + equipo automático
  if (planId === "teams") {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("name, team_role, team_id")
      .eq("email", email)
      .single();

    if (sub?.team_role !== "owner") {
      const brokerName = sub?.name || email.split("@")[0];
      const team = await getOrCreateTeam(email, `Equipo de ${brokerName}`);
      await supabaseAdmin
        .from("subscriptions")
        .update({ team_id: team.id, team_role: "owner" })
        .eq("email", email);
      // Reactivar equipo si estaba pausado
      await supabaseAdmin
        .from("teams")
        .update({ status: "active", paid_until: null })
        .eq("id", team.id);
    } else if (sub?.team_id) {
      // Broker renueva — reactivar equipo
      await supabaseAdmin
        .from("teams")
        .update({ status: "active", paid_until: null })
        .eq("id", sub.team_id);
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
