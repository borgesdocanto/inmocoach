import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { syncAndPersist, computeWeekStats } from "../../../lib/calendarSync";
import { computeAndSaveStreak } from "../../../lib/streak";
import { getValidAccessToken } from "../../../lib/googleToken";
import { PRODUCTIVITY_GOAL } from "../../../lib/brand";

// Corre lunes a viernes a las 20hs UTC (17hs Argentina)
// Sincroniza solo usuarios con racha activa para que el streak-alert de las 18hs tenga datos frescos
// vercel.json: "0 20 * * 1-5"

const BATCH_SIZE = 5;

async function syncUser(user: { email: string; team_id: string | null }): Promise<"synced" | "skipped" | "error"> {
  try {
    const accessToken = await getValidAccessToken(user.email);
    if (!accessToken) return "skipped";

    // Sync liviano: solo 14 días (suficiente para la racha)
    const events = await syncAndPersist(accessToken, user.email, user.team_id, 14);

    // Recalcular racha con datos frescos
    const dailySummaries = Object.entries(
      events
        .filter((e: any) => e.isGreen)
        .reduce((acc: Record<string, number>, e: any) => {
          const day = e.start.slice(0, 10);
          acc[day] = (acc[day] || 0) + 1;
          return acc;
        }, {})
    ).map(([date, greenCount]) => ({ date, greenCount }));

    await computeAndSaveStreak(user.email, dailySummaries);
    return "synced";
  } catch (err: any) {
    console.error(`Daily sync error ${user.email}:`, err?.message);
    return "error";
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = req.headers["x-cron-secret"] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });

  // Solo usuarios con racha activa >= 1 día
  const { data: users } = await supabaseAdmin
    .from("subscriptions")
    .select("email, team_id, streak_current")
    .gte("streak_current", 1)
    .not("google_access_token", "is", null);

  if (!users?.length) {
    return res.status(200).json({ ok: true, message: "No hay usuarios con racha activa", synced: 0 });
  }

  console.log(`🔄 Daily sync: ${users.length} usuarios con racha activa`);

  // Responder inmediatamente
  res.status(200).json({ ok: true, total: users.length, message: `Sincronizando ${users.length} usuarios en background` });

  // Procesar en tandas de 5
  const results = { synced: 0, skipped: 0, error: 0 };
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(syncUser));
    for (const r of batchResults) {
      if (r.status === "fulfilled") results[r.value]++;
      else results.error++;
    }
    if (i + BATCH_SIZE < users.length) await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`✅ Daily sync completo:`, results);
}
