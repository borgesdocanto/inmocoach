import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = session.user.email;

  if (req.method === "POST") {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: "Datos inválidos" });

    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert({
        email, endpoint, p256dh: keys.p256dh, auth: keys.auth,
        user_agent: req.headers["user-agent"] || "",
        updated_at: new Date().toISOString(),
      }, { onConflict: "email,endpoint" });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { endpoint } = req.body;
    await supabaseAdmin.from("push_subscriptions").delete().eq("email", email).eq("endpoint", endpoint);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
