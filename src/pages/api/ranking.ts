import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { getEffectiveEmail } from "../../lib/impersonation";
import { supabaseAdmin } from "../../lib/supabase";
import { getGoals } from "../../lib/appConfig";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session) ?? session.user.email;
  const mode = (req.query.mode as string) || "iac_week";

  // Obtener team_id del usuario para pasar config correcta del tenant
  const { data: meSub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id")
    .eq("email", email)
    .single();
  const { weeklyGoal } = await getGoals(meSub?.team_id);

  try {
    const { data: me } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id, rank_slug")
      .eq("email", email)
      .single();

    const weekStart = getMonday();
    const FREEMIUM_DAYS = 7;

    // ── Ranking GLOBAL: todos los usuarios activos de la plataforma ──
    // Solo scores numéricos — nunca se exponen emails de otros tenants al frontend
    const { data: allUsersRaw } = await supabaseAdmin
      .from("subscriptions")
      .select("email, rank_slug, plan, status, created_at")
      .in("status", ["active"]);

    const allUsers = (allUsersRaw ?? []).filter(u => {
      if (u.plan !== "free") return true;
      const diffDays = (Date.now() - new Date(u.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= FREEMIUM_DAYS;
    });

    const allEmails = allUsers.map(u => u.email);

    let globalScores: { email: string; score: number }[] = [];

    if (mode === "iac_week") {
      const { data: wsData } = await supabaseAdmin
        .from("weekly_stats").select("email, iac")
        .eq("week_start", weekStart).in("email", allEmails);

      const wsMap: Record<string, number> = {};
      for (const row of wsData ?? []) wsMap[row.email] = row.iac;

      const { data: evData } = await supabaseAdmin
        .from("calendar_events").select("user_email")
        .eq("is_productive", true).gte("start_at", weekStart).in("user_email", allEmails);

      const evMap: Record<string, number> = {};
      for (const ev of evData ?? []) evMap[ev.user_email] = (evMap[ev.user_email] || 0) + 1;

      globalScores = allEmails.map(e => ({
        email: e,
        score: wsMap[e] ?? (evMap[e] ? Math.round((evMap[e] / weeklyGoal) * 100) : 0),
      }));

    } else if (mode === "iac_avg") {
      const { data: wsAll } = await supabaseAdmin
        .from("weekly_stats").select("email, iac").gt("iac", 0).in("email", allEmails);

      const byEmail: Record<string, number[]> = {};
      for (const row of wsAll ?? []) {
        if (!byEmail[row.email]) byEmail[row.email] = [];
        byEmail[row.email].push(row.iac);
      }

      globalScores = allEmails.map(e => ({
        email: e,
        score: byEmail[e] ? Math.round(byEmail[e].reduce((a, b) => a + b, 0) / byEmail[e].length) : 0,
      }));

    } else if (mode === "rank") {
      const RANK_ORDER = ["junior", "corredor", "asesor", "senior", "top_producer", "master_broker"];
      const rankMap: Record<string, string> = {};
      for (const u of allUsers) rankMap[u.email] = u.rank_slug ?? "junior";

      globalScores = allEmails.map(e => ({
        email: e,
        score: RANK_ORDER.indexOf(rankMap[e] ?? "junior"),
      }));
    }

    globalScores.sort((a, b) => b.score - a.score || a.email.localeCompare(b.email));

    const globalTotal = globalScores.length;
    const myGlobalIdx = globalScores.findIndex(r => r.email === email);
    const globalRank = myGlobalIdx >= 0 ? myGlobalIdx + 1 : globalTotal;

    // Lista anónima para el frontend: posición + score, sin email ni nombre
    // El frontend puede mostrar "Agente #1, Agente #2..." con mi posición destacada
    const globalList = globalScores.map((s, idx) => ({
      position: idx + 1,
      score: s.score,
      isMe: s.email === email,
    }));

    // ── Ranking del EQUIPO: solo miembros del mismo team_id ──
    // Acá sí se exponen nombres porque son del mismo tenant
    let teamRank = 0, teamTotal = 0, teamName = "";
    let teamList: { position: number; name: string; score: number; isMe: boolean; role: string }[] = [];

    if (me?.team_id) {
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("agency_name, show_team_leaders, show_broker")
        .eq("id", me.team_id)
        .single();

      teamName = team?.agency_name || "Mi equipo";

      const { data: memberDetails } = await supabaseAdmin
        .from("subscriptions")
        .select("email, name, team_role")
        .eq("team_id", me.team_id);

      // Filtrar según preferencias del equipo
      let filteredMembers = memberDetails ?? [];
      if (!team?.show_broker) {
        filteredMembers = filteredMembers.filter(m => m.team_role !== "owner");
      }
      if (!team?.show_team_leaders) {
        filteredMembers = filteredMembers.filter(m => m.team_role !== "team_leader");
      }

      const memberEmails = filteredMembers.map(m => m.email);

      // Scores del equipo: filtrar del global ya calculado (mismo mode, misma lógica)
      const teamScores = globalScores
        .filter(s => memberEmails.includes(s.email))
        .map((s, idx) => ({
          position: idx + 1,
          score: s.score,
          isMe: s.email === email,
          name: filteredMembers.find(m => m.email === s.email)?.name ?? s.email.split("@")[0],
          role: filteredMembers.find(m => m.email === s.email)?.team_role ?? "member",
        }));

      teamTotal = teamScores.length;
      const myTeamEntry = teamScores.find(s => s.isMe);
      teamRank = myTeamEntry?.position ?? teamTotal;
      teamList = teamScores;
    }

    return res.status(200).json({
      globalRank,
      globalTotal,
      globalList,   // anónimo: [{ position, score, isMe }]
      teamRank,
      teamTotal,
      teamName,
      teamList,     // con nombres: [{ position, name, score, isMe, role }]
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
