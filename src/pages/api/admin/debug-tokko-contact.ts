// GET /api/admin/debug-tokko-contact — ver estructura real de un contacto de Tokko
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).end();

  const { data: team } = await supabaseAdmin
    .from("teams").select("tokko_api_key")
    .eq("id", "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93").single();

  const today = new Date().toISOString().split("T")[0];
  const r = await fetch(
    `https://tokkobroker.com/api/v1/contact/?key=${team!.tokko_api_key}&deleted_at__gt=${today}&format=json&limit=1`,
    { signal: AbortSignal.timeout(15000) }
  );
  const d = await r.json();
  // Devolver el primer contacto completo para ver su estructura real
  return res.json({ first: d.objects?.[0] ?? null });
}
