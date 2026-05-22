// pages/api/admin/extend-trial.ts — Extender trial de un usuario free

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();
  const { isSuperAdmin } = await import("../../../lib/adminGuard");
  if (!isSuperAdmin(session.user.email)) return res.status(403).end();

  const { email, trial_ends_at } = req.body;
  if (!email || !trial_ends_at) {
    return res.status(400).json({ error: "email y trial_ends_at son obligatorios" });
  }

  // Validar que la fecha sea válida y futura
  const fecha = new Date(trial_ends_at);
  if (isNaN(fecha.getTime())) {
    return res.status(400).json({ error: "Fecha inválida" });
  }

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .update({ trial_ends_at: fecha.toISOString() })
    .eq("email", email)
    .eq("plan", "free")
    .select("email, name, plan, trial_ends_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Usuario no encontrado o no es plan free" });

  return res.json({ ok: true, user: data });
}
