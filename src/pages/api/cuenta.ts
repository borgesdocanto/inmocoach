import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";
import { calcTeamsTotal, getTierForAgents, pricePerAgent } from "../../lib/pricing";
import { isVipEmail } from "../../lib/plans";
import { SUPER_ADMIN_EMAIL } from "../../lib/brand";

const BASE_PRICE = 10500;
const MP_TOKEN = process.env.MP_ACCESS_TOKEN!;
const BASE_URL = process.env.NEXTAUTH_URL!;

async function mp(path: string, method: string, body?: any) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MP_TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, data: await res.json() };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });
  const email = session.user.email;

  // ── GET — datos de cuenta ──────────────────────────────────────────────────
  if (req.method === "GET") {
    const isVip = isVipEmail(email) || email === SUPER_ADMIN_EMAIL;

    const { data: sub, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .select("*, teams(agency_name, max_agents)")
      .eq("email", email)
      .single();

    if (!sub) {
      console.error("[cuenta] No encontrado para email:", email, "- error supabase:", JSON.stringify(subError));
      return res.status(404).json({ error: "No encontrado", email, debug: subError?.message });
    }

    // VIP / super admin — cuenta activa permanente sin MP
    if (isVip) {
      let agentCount = 1;
      if (sub.team_role === "owner" && sub.team_id) {
        const { count } = await supabaseAdmin
          .from("subscriptions")
          .select("email", { count: "exact" })
          .eq("team_id", sub.team_id);
        agentCount = count || 1;
      }
      const tier = getTierForAgents(agentCount);
      return res.status(200).json({
        plan: sub.plan,
        status: "active",
        agentCount,
        total: calcTeamsTotal(BASE_PRICE, agentCount),
        tier: tier.label,
        discountPct: tier.discountPct,
        currentPeriodEnd: null,
        nextPaymentDate: null,
        mpSubscriptionId: null,
        mpStatus: "vip",
        agencyName: sub.teams?.agency_name || null,
        teamRole: sub.team_role,
        isOwner: sub.team_role === "owner",
        isVip: true,
      });
    }

    // Contar agentes del equipo si es owner
    let agentCount = 1;
    if (sub.team_role === "owner" && sub.team_id) {
      const { count } = await supabaseAdmin
        .from("subscriptions")
        .select("email", { count: "exact" })
        .eq("team_id", sub.team_id);
      agentCount = count || 1;
    }

    // Obtener info de MP si tiene suscripción activa
    let mpInfo: any = null;
    if (sub.mp_subscription_id) {
      const { data } = await mp(`/preapproval/${sub.mp_subscription_id}`, "GET");
      if (data?.id) mpInfo = data;
    }

    const total = calcTeamsTotal(BASE_PRICE, agentCount);
    const tier = getTierForAgents(agentCount);

    return res.status(200).json({
      plan: sub.plan,
      status: sub.status,
      agentCount,
      total,
      tier: tier.label,
      discountPct: tier.discountPct,
      currentPeriodEnd: sub.current_period_end,
      mpSubscriptionId: sub.mp_subscription_id,
      mpStatus: mpInfo?.status || null,
      nextPaymentDate: mpInfo?.next_payment_date || sub.current_period_end,
      agencyName: sub.teams?.agency_name || null,
      teamRole: sub.team_role,
      isOwner: sub.team_role === "owner",
    });
  }

  // ── POST — cambiar cantidad de agentes ────────────────────────────────────
  if (req.method === "POST") {
    const { action, agentCount } = req.body;

    if (action === "change_agents") {
      const count = Math.max(1, parseInt(agentCount, 10));

      // Redireccionar al checkout con el nuevo count
      const checkoutRes = await fetch(`${BASE_URL}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "cookie": req.headers.cookie || "" },
        body: JSON.stringify({ agentCount: count }),
      });
      const checkoutData = await checkoutRes.json();
      return res.status(200).json(checkoutData);
    }

    // ── Cancelar suscripción ────────────────────────────────────────────────
    if (action === "cancel") {
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("mp_subscription_id, mp_plan_id")
        .eq("email", email)
        .single();

      if (sub?.mp_subscription_id) {
        await mp(`/preapproval/${sub.mp_subscription_id}`, "PATCH", { status: "cancelled" });
      }
      if (sub?.mp_plan_id) {
        await mp(`/preapproval_plan/${sub.mp_plan_id}`, "PATCH", { status: "cancelled" });
      }

      await supabaseAdmin
        .from("subscriptions")
        .update({ plan: "free", status: "cancelled", mp_subscription_id: null, mp_plan_id: null })
        .eq("email", email);

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Acción inválida" });
  }

  return res.status(405).end();
}
