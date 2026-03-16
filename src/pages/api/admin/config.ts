import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { supabaseAdmin } from "../../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).end();

  if (req.method === "GET") {
    const { data } = await supabaseAdmin.from("app_config").select("key, value");
    const config: Record<string, string> = {};
    for (const row of data || []) config[row.key] = row.value;
    return res.status(200).json(config);
  }

  if (req.method === "POST") {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: "key y value requeridos" });
    const { error } = await supabaseAdmin.from("app_config")
      .upsert({ key, value: String(value) }, { onConflict: "key" });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
