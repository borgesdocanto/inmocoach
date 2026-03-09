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
    // Obtener team_id del usuario
    const { data: me } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id, rank_slug")
      .eq("email", email)
      .single();

    // ── RANKING GLOBAL ──
    // Todos los usuarios con plan activo o en freemium con actividad
    let globalRank = 0;
    let globalTotal = 0;

    if (mode === "iac_week") {
      // Reuniones esta semana desde weekly_stats, fallback a calendar_events
      const weekStart = getMonday();
      let global = null;
      const { data: wsData } = await supabaseAdmin
        .from("weekly_stats")
        .select("email, iac")
        .eq("week_start", weekStart)
        .order("iac", { ascending: false });

      if (wsData && wsData.length > 0) {
        global = wsData;
      } else {
        // Fallback: contar eventos verdes esta semana desde calendar_events
        const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
        const { data: evData } = await supabaseAdmin
          .from("calendar_events")
          .select("user_email")
          .eq("is_productive", true)
          .gte("start_at", weekStart)
          .lte("start_at", weekEnd.toISOString().slice(0, 10));

        if (evData) {
          const byEmail: Record<string, number> = {};
          for (const ev of evData) {
            byEmail[ev.user_email] = (byEmail[ev.user_email] || 0) + 1;
          }
          global = Object.entries(byEmail)
            .map(([e, count]) => ({ email: e, iac: Math.round((count / 15) * 100) }))
            .sort((a, b) => b.iac - a.iac);
        }
      }

      globalTotal = global?.length ?? 0;
      // Si el usuario no tiene datos esta semana, igual lo incluimos en último lugar
      if (globalTotal === 0) { globalRank = 1; globalTotal = 1; }
      else {
        const myIdx = global!.findIndex(r => r.email === email);
        globalRank = myIdx >= 0 ? myIdx + 1 : globalTotal + 1;
        if (myIdx < 0) globalTotal += 1; // incluir al usuario aunque no tenga datos
      }

    } else if (mode === "iac_avg") {
      // Promedio de las últimas 12 semanas
      const { data: allEmails } = await supabaseAdmin
        .from("weekly_stats")
        .select("email, iac")
        .gt("iac", 0);

      // Agrupar por email
      const byEmail: Record<string, number[]> = {};
      for (const row of allEmails ?? []) {
        if (!byEmail[row.email]) byEmail[row.email] = [];
        byEmail[row.email].push(row.iac);
      }
      const averages = Object.entries(byEmail)
        .map(([e, iacs]) => ({ email: e, avg: Math.round(iacs.reduce((a, b) => a + b, 0) / iacs.length) }))
        .sort((a, b) => b.avg - a.avg);

      globalTotal = averages.length;
      const myIdx = averages.findIndex(r => r.email === email);
      globalRank = myIdx >= 0 ? myIdx + 1 : globalTotal + 1;

    } else if (mode === "rank") {
      const RANK_ORDER = ["junior", "corredor", "asesor", "senior", "top_producer", "master_broker"];
      const { data: allRanks } = await supabaseAdmin
        .from("subscriptions")
        .select("email, rank_slug")
        .not("rank_slug", "is", null);

      const sorted = (allRanks ?? [])
        .sort((a, b) => RANK_ORDER.indexOf(b.rank_slug) - RANK_ORDER.indexOf(a.rank_slug));

      globalTotal = sorted.length;
      const myIdx = sorted.findIndex(r => r.email === email);
      globalRank = myIdx >= 0 ? myIdx + 1 : globalTotal + 1;
    }

    // ── RANKING DEL EQUIPO ──
    let teamRank = 0;
    let teamTotal = 0;
    let teamName = "";

    if (me?.team_id) {
      // Obtener miembros del equipo
      const { data: members } = await supabaseAdmin
        .from("subscriptions")
        .select("email, rank_slug")
        .eq("team_id", me.team_id);

      const memberEmails = (members ?? []).map(m => m.email);
      teamTotal = memberEmails.length;

      // Obtener nombre del equipo
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("agency_name")
        .eq("id", me.team_id)
        .single();
      teamName = team?.agency_name || "Mi equipo";

      if (mode === "iac_week") {
        const weekStart = getMonday();
        const { data: wsTeam } = await supabaseAdmin
          .from("weekly_stats")
          .select("email, iac")
          .in("email", memberEmails)
          .eq("week_start", weekStart)
          .order("iac", { ascending: false });

        let teamStats = wsTeam;
        if (!teamStats || teamStats.length === 0) {
          // Fallback: calendar_events esta semana
          const { data: evTeam } = await supabaseAdmin
            .from("calendar_events")
            .select("user_email")
            .eq("is_productive", true)
            .gte("start_at", weekStart)
            .in("user_email", memberEmails);
          if (evTeam) {
            const byEmail: Record<string, number> = {};
            for (const ev of evTeam) { byEmail[ev.user_email] = (byEmail[ev.user_email] || 0) + 1; }
            teamStats = Object.entries(byEmail)
              .map(([e, count]) => ({ email: e, iac: Math.round((count / 15) * 100) }))
              .sort((a: any, b: any) => b.iac - a.iac) as any;
          }
        }

        const myIdx = teamStats?.findIndex((r: any) => r.email === email) ?? -1;
        teamRank = myIdx >= 0 ? myIdx + 1 : teamTotal;

      } else if (mode === "iac_avg") {
        const { data: teamHistory } = await supabaseAdmin
          .from("weekly_stats")
          .select("email, iac")
          .in("email", memberEmails)
          .gt("iac", 0);

        const byEmail: Record<string, number[]> = {};
        for (const row of teamHistory ?? []) {
          if (!byEmail[row.email]) byEmail[row.email] = [];
          byEmail[row.email].push(row.iac);
        }
        const averages = Object.entries(byEmail)
          .map(([e, iacs]) => ({ email: e, avg: Math.round(iacs.reduce((a, b) => a + b, 0) / iacs.length) }))
          .sort((a, b) => b.avg - a.avg);

        const myIdx = averages.findIndex(r => r.email === email);
        teamRank = myIdx >= 0 ? myIdx + 1 : teamTotal;

      } else if (mode === "rank") {
        const RANK_ORDER = ["junior", "corredor", "asesor", "senior", "top_producer", "master_broker"];
        const sorted = (members ?? [])
          .sort((a, b) => RANK_ORDER.indexOf(b.rank_slug) - RANK_ORDER.indexOf(a.rank_slug));
        const myIdx = sorted.findIndex(r => r.email === email);
        teamRank = myIdx >= 0 ? myIdx + 1 : teamTotal;
      }
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
