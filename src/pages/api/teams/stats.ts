import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getStoredEvents, computePeriodStats, getQuarter, getSemester, getYear } from "../../../lib/calendarSync";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  // Verificar que es owner o team_leader
  const { data: reqSub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role, name")
    .eq("email", session.user.email)
    .single();

  if (!reqSub?.team_id || !["owner", "team_leader"].includes(reqSub.team_role)) {
    return res.status(403).json({ error: "Sin acceso" });
  }

  // Obtener todos los miembros del equipo
  const { data: members } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, avatar, team_role")
    .eq("team_id", reqSub.team_id);

  if (!members?.length) return res.status(200).json({ members: [], team: null });

  const period = (req.query.period as string) || "last30";
  const year = new Date().getFullYear();
  const now = new Date();

  function getRange(p: string): { from: Date; to: Date; days: number } {
    switch (p) {
      case "q1": return getQuarter(1, year);
      case "q2": return getQuarter(2, year);
      case "q3": return getQuarter(3, year);
      case "q4": return getQuarter(4, year);
      case "s1": return getSemester(1, year);
      case "s2": return getSemester(2, year);
      case "annual": return getYear(year);
      case "last90": return { from: new Date(now.getTime() - 90 * 86400000), to: now, days: 90 };
      default: return { from: new Date(now.getTime() - 30 * 86400000), to: now, days: 30 };
    }
  }

  const { from, to, days } = getRange(period);

  // Calcular stats de cada miembro en paralelo
  const memberStats = await Promise.all(
    members.map(async m => {
      const events = await getStoredEvents(m.email, from, to);
      const stats = computePeriodStats(events, days);

      // Tendencia: comparar última semana vs semana anterior
      const lastWeekFrom = new Date(now.getTime() - 7 * 86400000);
      const prevWeekFrom = new Date(now.getTime() - 14 * 86400000);
      const [lastWeek, prevWeek] = await Promise.all([
        getStoredEvents(m.email, lastWeekFrom, now),
        getStoredEvents(m.email, prevWeekFrom, lastWeekFrom),
      ]);
      const trend = lastWeek.length > prevWeek.length ? "up"
        : lastWeek.length < prevWeek.length ? "down" : "stable";

      // Semáforo
      const signal = stats.avgPerWeek >= 10 ? "green"
        : stats.avgPerWeek >= 6 ? "yellow" : "red";

      return {
        email: m.email,
        name: m.name,
        avatar: m.avatar,
        teamRole: m.team_role,
        stats,
        trend,
        signal,
        lastWeekTotal: lastWeek.length,
      };
    })
  );

  // Totales del equipo
  const teamTotals = memberStats.reduce((acc: {total:number;tasaciones:number;visitas:number;propuestas:number;firmas:number}, m) => ({
    total: acc.total + m.stats.total,
    tasaciones: acc.tasaciones + m.stats.tasaciones,
    visitas: acc.visitas + m.stats.visitas,
    propuestas: acc.propuestas + m.stats.propuestas,
    firmas: acc.firmas + (m.stats.firmas ?? 0),
  }), { total: 0, tasaciones: 0, visitas: 0, propuestas: 0, firmas: 0 });

  const greenCount = memberStats.filter(m => m.signal === "green").length;
  const yellowCount = memberStats.filter(m => m.signal === "yellow").length;
  const redCount = memberStats.filter(m => m.signal === "red").length;

  // Ordenar: rojo primero (necesitan atención), luego amarillo, luego verde
  memberStats.sort((a, b) => {
    const order = { red: 0, yellow: 1, green: 2 };
    return (order as any)[a.signal] - (order as any)[b.signal];
  });

  return res.status(200).json({
    period,
    members: memberStats,
    teamTotals,
    summary: { greenCount, yellowCount, redCount, total: members.length },
  });
}
