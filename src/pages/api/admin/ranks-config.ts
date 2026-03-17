import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { supabaseAdmin } from "../../../lib/supabase";
import { invalidateAppConfig } from "../../../lib/appConfig";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).end();

  if (req.method === "GET") {
    const { data: ranks } = await supabaseAdmin.from("rank_config").select("*").order("sort_order");
    const { data: config } = await supabaseAdmin.from("app_config")
      .select("key, value").in("key", ["rank_weeks_to_up", "rank_weeks_to_down"]);
    const cfg: Record<string, string> = {};
    for (const row of config || []) cfg[row.key] = row.value;
    return res.status(200).json({ ranks, weeksToUp: cfg.rank_weeks_to_up ?? "4", weeksToDown: cfg.rank_weeks_to_down ?? "2" });
  }

  if (req.method === "POST") {
    const { ranks, weeksToUp, weeksToDown } = req.body;
    if (ranks) {
      for (const r of ranks) {
        await supabaseAdmin.from("rank_config").upsert({
          slug: r.slug, label: r.label, icon: r.icon, sort_order: r.sortOrder,
          min_weeks: r.minWeeks, min_iac_up: r.minIacUp, min_iac_keep: r.minIacKeep,
          min_streak: r.minStreak ?? null,
        }, { onConflict: "slug" });
      }
    }
    if (weeksToUp) await supabaseAdmin.from("app_config").upsert({ key: "rank_weeks_to_up", value: String(weeksToUp) }, { onConflict: "key" });
    if (weeksToDown) await supabaseAdmin.from("app_config").upsert({ key: "rank_weeks_to_down", value: String(weeksToDown) }, { onConflict: "key" });
    invalidateAppConfig();
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
