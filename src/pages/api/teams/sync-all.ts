import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { syncAndPersist } from "../../../lib/calendarSync";
import { getGoals } from "../../../lib/appConfig";
import { getValidAccessToken } from "../../../lib/googleToken";
import { computeAndSaveStreak } from "../../../lib/streak";
import { saveWeeklyStatsAndRank } from "../../../lib/ranks";
import { startOfWeek, format } from "date-fns";

export const config = { maxDuration: 60 };

// Sincroniza agentes y propiedades de Tokko para un equipo dado
async function syncTokkoTeam(teamId: string, apiKey: string): Promise<{ agents: number; errors: string[] }> {
  const result = { agents: 0, errors: [] as string[] };
  try {
    const fr = await fetch(`https://www.tokkobroker.com/api/v1/user/?key=${apiKey}&format=json&limit=200`);
    if (!fr.ok) throw new Error(`Tokko users ${fr.status}`);
    const ud: any = await fr.json();
    const users: any[] = ud.objects || [];
    if (users.length > 0) {
      const rows = users.map((u: any) => ({
        tokko_id: u.id,
        team_id: teamId,
        name: u.name,
        email: u.email?.toLowerCase() || null,
        phone: u.phone || u.cellphone || null,
        picture: u.picture || null,
        position: u.position || null,
        branch_id: u.branch?.id || u.office?.id || null,
        branch_name: u.branch?.name || u.office?.name || null,
        synced_at: new Date().toISOString(),
      }));
      await supabaseAdmin.from("tokko_agents").upsert(rows, { onConflict: "tokko_id" });

      // Eliminar agentes que ya no están en Tokko
      const activeIds = users.map((u: any) => u.id);
      if (activeIds.length > 0) {
        await supabaseAdmin
          .from("tokko_agents")
          .delete()
          .eq("team_id", teamId)
          .not("tokko_id", "in", `(${activeIds.join(",")})`);
      }

      result.agents = users.length;
    }
  } catch (e: any) {
    result.errors.push(`tokko_agents: ${e.message}`);
  }
  return result;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { data: requester } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", session.user.email)
    .single();

  if (!requester?.team_id || !["owner", "team_leader"].includes(requester.team_role))
    return res.status(403).json({ error: "Sin acceso" });

  // 1. Sincronizar agentes de Tokko (para detectar altas y bajas)
  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("tokko_api_key")
    .eq("id", requester.team_id)
    .single();

  let tokkoResult = { agents: 0, errors: [] as string[] };
  if (team?.tokko_api_key) {
    tokkoResult = await syncTokkoTeam(requester.team_id, team.tokko_api_key);
  }

  // 2. Sincronizar calendarios de los miembros activos del equipo
  const { data: members } = await supabaseAdmin
    .from("subscriptions")
    .select("email, team_id, streak_best")
    .eq("team_id", requester.team_id)
    .not("google_access_token", "is", null);

  if (!members?.length) {
    return res.status(200).json({ ok: true, synced: 0, tokko: tokkoResult });
  }

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const syncMember = async (member: typeof members[0]) => {
    const accessToken = await getValidAccessToken(member.email);
    if (!accessToken) return { email: member.email, status: "no_token" };
    const events = await syncAndPersist(accessToken, member.email, member.team_id, 90);
    const byDay: Record<string, number> = {};
    for (const e of events) {
      if (e.isGreen) byDay[e.start.slice(0, 10)] = (byDay[e.start.slice(0, 10)] || 0) + 1;
    }
    const dailySummaries = Object.entries(byDay).map(([date, greenCount]) => ({ date, greenCount }));
    const streakData = await computeAndSaveStreak(member.email, dailySummaries, member.team_id).catch(() => null);
    const weekGreen = events.filter(e => e.isGreen && e.start.slice(0, 10) >= weekStart);
    const { weeklyGoal } = await getGoals(requester.team_id);
    const weekIac = Math.min(100, Math.round((weekGreen.length / weeklyGoal) * 100));
    await saveWeeklyStatsAndRank(member.email, weekStart, weekIac, weekGreen.length, (streakData as any)?.best ?? member.streak_best ?? 0);
    return { email: member.email, status: "synced", events: events.length };
  };

  const BATCH_SIZE = 5;
  const memberResults: { email: string; status: string; events?: number; error?: string }[] = [];
  for (let i = 0; i < members.length; i += BATCH_SIZE) {
    const batch = members.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(syncMember));
    for (const r of batchResults) {
      if (r.status === "fulfilled") memberResults.push(r.value);
      else memberResults.push({ email: "unknown", status: "error", error: r.reason?.message });
    }
  }

  const synced = memberResults.filter(r => r.status === "synced").length;
  const errors = memberResults.filter(r => r.status === "error" || r.status === "no_token");
  return res.status(200).json({ ok: true, synced, total: members.length, errors, results: memberResults, tokko: tokkoResult });
}
