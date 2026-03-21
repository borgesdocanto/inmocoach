// Endpoint liviano para polling — solo devuelve cuándo fue la última sync
// No llama a Google, solo lee un timestamp de DB
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).end();

  // Leer el evento más reciente en DB — si cambió desde lastKnown, hay datos nuevos
  const { data } = await supabaseAdmin
    .from("calendar_events")
    .select("updated_at")
    .eq("user_email", session.user.email)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    lastUpdated: data?.updated_at ?? null,
  });
}
