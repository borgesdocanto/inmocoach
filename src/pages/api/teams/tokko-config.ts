// Permite a brokers/owners configurar su API key de Tokko
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { supabaseAdmin } from "../../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  const email = session.user.email;

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", email)
    .single();

  const isOwner = sub?.team_role === "owner" || isSuperAdmin(email);
  if (!isOwner) return res.status(403).json({ error: "Solo el broker puede configurar Tokko" });
  if (!sub?.team_id) return res.status(400).json({ error: "No tenés un equipo configurado" });

  if (req.method === "GET") {
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", sub.team_id)
      .single();

    const key = team?.tokko_api_key;
    return res.status(200).json({
      hasKey: !!key,
      keyPreview: key ? `${"•".repeat(Math.max(0, key.length - 4))}${key.slice(-4)}` : null,
    });
  }

  if (req.method === "POST") {
    const { apiKey, remove } = req.body;

    if (remove) {
      await supabaseAdmin.from("teams").update({ tokko_api_key: null }).eq("id", sub.team_id);
      return res.status(200).json({ ok: true });
    }

    if (!apiKey || typeof apiKey !== "string" || apiKey.length < 10) {
      return res.status(400).json({ error: "API key inválida" });
    }

    // Verificar antes de guardar
    const testRes = await fetch(
      `https://www.tokkobroker.com/api/v1/property/?key=${apiKey}&format=json&limit=1`
    );
    if (!testRes.ok) {
      return res.status(200).json({ ok: false, error: "API key inválida — verificá en Tokko → Mi empresa → Permisos" });
    }

    await supabaseAdmin.from("teams").update({ tokko_api_key: apiKey }).eq("id", sub.team_id);

    // Sync inmediato en background
    fetch(`${process.env.NEXTAUTH_URL}/api/cron/tokko-sync`, {
      method: "POST",
      headers: { "x-cron-secret": process.env.CRON_SECRET!, "Content-Type": "application/json" },
      body: JSON.stringify({ targetTeamId: sub.team_id }),
    }).catch(() => {});

    return res.status(200).json({ ok: true, message: "Conectado con Tokko — sincronizando..." });
  }

  return res.status(405).end();
}
