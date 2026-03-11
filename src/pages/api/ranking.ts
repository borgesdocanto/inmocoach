import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = session.user.email;
  const mode = (req.query.mode as string) || "iac_week";

  try {
    const { data: me } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id, rank_slug")
      .eq("email", email)
      .single();

    // Solo usuarios con acceso activo (excluye freemium expirado y cancelados)
    const { data: allUsersRaw } = await supabaseAdmin
      .from("subscriptions")
      .select("email, rank_slug, plan, status, created_at")
      .in("status", ["active"]);

    const FREEMIUM_DAYS = 7;
    const allUsers = (allUsersRaw ?? []).filter(u => {
      if (u.plan !== "free") return true;
      const created = new Date(u.created_at);
      const diffDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= FREEMIUM_DAYS;
    });

    const allEmails = (allUsers ?? []).map(u => u.email);

    const weekStart = getMonday();

    // ── Construir scores globales ──
    let scores: { email: string; score: number }[] = [];

    if (mode === "iac_week") {
      // Obtener weekly_stats de esta semana para todos
      const { data: wsData } = await supabaseAdmin
        .from("weekly_stats")
        .select("email, iac")
        .eq("week_start", weekStart)
        .in("email", allEmails);

      const wsMap: Record<string, number> = {};
      for (const row of wsData ?? []) wsMap[row.email] = row.iac;

      // Fallback: calendar_events esta semana para los que no tienen weekly_stats
      const { data: evData } = await supabaseAdmin
        .from("calendar_events")
        .select("user_email")
        .eq("is_productive", true)
        .gte("start_at", weekStart)
        .in("user_email", allEmails);

      const evMap: Record<string, number> = {};
      for (const ev of evData ?? []) evMap[ev.user_email] = (evMap[ev.user_email] || 0) + 1;

      // Todos los usuarios, con 0 si no tienen datos
      scores = allEmails.map(e => ({
        email: e,
        score: wsMap[e] ?? (evMap[e] ? Math.round((evMap[e] / 15) * 100) : 0),
      }));

    } else if (mode === "iac_avg") {
      const { data: wsAll } = await supabaseAdmin
        .from("weekly_stats")
        .select("email, iac")
        .gt("iac", 0)
        .in("email", allEmails);

      const byEmail: Record<string, number[]> = {};
      for (const row of wsAll ?? []) {
        if (!byEmail[row.email]) byEmail[row.email] = [];
        byEmail[row.email].push(row.iac);
      }

      scores = allEmails.map(e => ({
        email: e,
        score: byEmail[e] ? Math.round(byEmail[e].reduce((a, b) => a + b, 0) / byEmail[e].length) : 0,
      }));

    } else if (mode === "rank") {
      const RANK_ORDER = ["junior", "corredor", "asesor", "senior", "top_producer", "master_broker"];
      const rankMap: Record<string, string> = {};
      for (const u of allUsers ?? []) rankMap[u.email] = u.rank_slug ?? "junior";

      scores = allEmails.map(e => ({
        email: e,
        score: RANK_ORDER.indexOf(rankMap[e] ?? "junior"),
      }));
    }

    // Ordenar: mayor score primero, empate → orden alfabético estable
    scores.sort((a, b) => b.score - a.score || a.email.localeCompare(b.email));

    const globalTotal = scores.length;
    const myIdx = scores.findIndex(r => r.email === email);
    const globalRank = myIdx >= 0 ? myIdx + 1 : globalTotal;

    // ── Ranking del equipo ──
    let teamRank = 0, teamTotal = 0, teamName = "";

    if (me?.team_id) {
      const { data: members } = await supabaseAdmin
        .from("subscriptions")
        .select("email, rank_slug")
        .eq("team_id", me.team_id);

      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("agency_name, show_team_leaders, show_broker")
        .eq("id", me.team_id)
        .single();

      teamName = team?.agency_name || "Mi equipo";

      // Filtrar según preferencias del equipo
      let memberEmails = (members ?? []).map(m => m.email);

      // Filtrar broker y TL según settings
      const { data: memberDetails } = await supabaseAdmin
        .from("subscriptions")
        .select("email, team_role")
        .in("email", memberEmails);

      const ownerEmail = memberDetails?.find(m => m.team_role === "owner")?.email;
      if (!team?.show_broker && ownerEmail) {
        memberEmails = memberEmails.filter(e => e !== ownerEmail);
      }
      if (!team?.show_team_leaders) {
        const tlEmails = new Set(memberDetails?.filter(m => m.team_role === "team_leader").map(m => m.email));
        memberEmails = memberEmails.filter(e => !tlEmails.has(e));
      }

      const teamScores = scores.filter(s => memberEmails.includes(s.email));
      teamTotal = teamScores.length;
      const myTeamIdx = teamScores.findIndex(r => r.email === email);
      teamRank = myTeamIdx >= 0 ? myTeamIdx + 1 : teamTotal;
    }

    return res.status(200).json({
      globalRank,
      globalTotal,
      teamRank,
      teamTotal,
      teamName,
      hasTeam: !!me?.team_id,
      mode,
    });

  } catch (err: any) {
    console.error("Ranking API error:", err?.message);
    return res.status(500).json({ error: "Error al calcular ranking" });
  }
}

function getMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}
