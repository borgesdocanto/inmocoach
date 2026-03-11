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

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("email", email)
      .single();

    if (!sub) return res.status(404).json({ error: "No encontrado" });

    // Traer agency_name del equipo por separado
    let agencyName: string | null = null;
    if (sub.team_id) {
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("agency_name")
        .eq("id", sub.team_id)
        .single();
      agencyName = team?.agency_name || null;
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
        agencyName: agencyName,
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

    // Estado del equipo (para broker con equipo pausado)
    let teamStatus: string | null = null;
    let teamPaidUntil: string | null = null;
    let teamId: string | null = sub.team_id || null;
    let savedAgentCount: number | null = null;
    if (sub.team_id) {
      const { data: teamRow } = await supabaseAdmin
        .from("teams")
        .select("status, paid_until, max_agents")
        .eq("id", sub.team_id)
        .single();
      teamStatus = teamRow?.status || "active";
      teamPaidUntil = teamRow?.paid_until || null;
      // Cuando el equipo está pausado, usar max_agents guardado (los agentes ya no tienen team_id activo)
      if (teamRow?.status === "paused" || teamRow?.status === "cancelled") {
        savedAgentCount = teamRow?.max_agents || null;
      }
    }

    // Si equipo pausado, usar savedAgentCount como base de facturación al retomar
    if (savedAgentCount && (teamStatus === "paused" || teamStatus === "cancelled")) {
      agentCount = savedAgentCount;
    }

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
      agencyName: agencyName,
      teamRole: sub.team_role,
      isOwner: sub.team_role === "owner",
      teamId,
      teamStatus,
      teamPaidUntil,
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
        .select("mp_subscription_id, mp_plan_id, team_id, team_role, current_period_end")
        .eq("email", email)
        .single();

      if (sub?.mp_subscription_id) {
        await mp(`/preapproval/${sub.mp_subscription_id}`, "PATCH", { status: "cancelled" });
      }
      if (sub?.mp_plan_id) {
        await mp(`/preapproval_plan/${sub.mp_plan_id}`, "PATCH", { status: "cancelled" });
      }

      // Si es broker con equipo, pausar equipo con paid_until = fin del período actual
      if (sub?.team_id && sub?.team_role === "owner") {
        const paidUntil = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
        await supabaseAdmin
          .from("teams")
          .update({ status: "paused", paid_until: paidUntil.toISOString() })
          .eq("id", sub.team_id);
      }

      await supabaseAdmin
        .from("subscriptions")
        .update({ plan: "free", status: "cancelled", mp_subscription_id: null, mp_plan_id: null })
        .eq("email", email);

      return res.status(200).json({ ok: true });
    }

    // ── Broker elige plan individual (eliminar equipo) ────────────────────
    if (action === "reset_to_individual") {
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("team_id, team_role")
        .eq("email", email)
        .single();

      if (sub?.team_id && sub?.team_role === "owner") {
        // Desasociar agentes — solo resetear plan a free si no tienen suscripción individual propia
        const { data: agentsToReset } = await supabaseAdmin
          .from("subscriptions")
          .select("email, mp_subscription_id, plan")
          .eq("team_id", sub.team_id)
          .neq("email", email);

        for (const agent of agentsToReset || []) {
          const keepPlan = agent.plan === "individual" && agent.mp_subscription_id;
          await supabaseAdmin
            .from("subscriptions")
            .update({ team_id: null, team_role: null, plan: keepPlan ? agent.plan : "free", status: "active" })
            .eq("email", agent.email);
        }

        // Marcar equipo como cancelado
        await supabaseAdmin
          .from("teams")
          .update({ status: "cancelled" })
          .eq("id", sub.team_id);

        // Desasociar broker del equipo
        await supabaseAdmin
          .from("subscriptions")
          .update({ team_id: null, team_role: null })
          .eq("email", email);
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Acción inválida" });
  }

  return res.status(405).end();
}
