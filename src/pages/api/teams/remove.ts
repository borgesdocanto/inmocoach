import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getOrCreateTeam } from "../../../lib/teams";
import { getPricing, calcTeamsTotal } from "../../../lib/pricing";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { memberEmail } = req.body;
  if (!memberEmail) return res.status(400).json({ error: "memberEmail requerido" });
  if (memberEmail === session.user.email) return res.status(400).json({ error: "No podés removerte a vos mismo" });

  // Solo owner puede remover
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_role, team_id")
    .eq("email", session.user.email)
    .single();

  if (sub?.team_role !== "owner") return res.status(403).json({ error: "Solo el owner puede remover agentes" });

  const team = await getOrCreateTeam(session.user.email, "");

  // Remover agente: limpiar team_id y team_role
  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({ team_id: null, team_role: null })
    .eq("email", memberEmail)
    .eq("team_id", team.id);

  if (error) return res.status(500).json({ error: error.message });

  // Contar agentes restantes
  const { count: remainingCount } = await supabaseAdmin
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("team_id", team.id)
    .not("team_role", "eq", "owner");

  const remaining = remainingCount ?? 0;
  const includedAgents = 10;

  // Si quedaron ≤10 agentes, programar downgrade al próximo ciclo
  if (remaining <= includedAgents) {
    await supabaseAdmin
      .from("teams")
      .update({ pending_agents: 0, pending_amount: 0 })
      .eq("id", team.id);
  } else {
    // Todavía hay extras — recalcular monto pendiente
    const pricing = await getPricing();
    const newAmount = calcTeamsTotal(pricing, remaining);
    await supabaseAdmin
      .from("teams")
      .update({ pending_agents: remaining, pending_amount: newAmount })
      .eq("id", team.id);
  }

  // Bajar max_agents si corresponde
  const newMax = Math.max(includedAgents, remaining);
  await supabaseAdmin
    .from("teams")
    .update({ max_agents: newMax })
    .eq("id", team.id);

  // Recalcular precio del broker
  fetch(`${process.env.NEXTAUTH_URL}/api/teams/recalculate-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "cookie": req.headers.cookie || "" },
  }).catch(e => console.error("recalculate-plan error:", e));

  return res.status(200).json({ ok: true, remaining, newMax });
}
