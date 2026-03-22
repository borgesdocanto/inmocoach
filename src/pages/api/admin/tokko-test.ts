import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { supabaseAdmin } from "../../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).end();

  // Leer API key de DB
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", "tokko_api_key")
    .single();

  const apiKey = data?.value;
  if (!apiKey) return res.status(200).json({ ok: false, message: "No hay API key configurada" });

  try {
    // Probar con endpoint de propiedades
    const [propsRes, usersRes] = await Promise.all([
      fetch(`https://www.tokkobroker.com/api/v1/property/?key=${apiKey}&format=json&limit=1`),
      fetch(`https://www.tokkobroker.com/api/v1/user/?key=${apiKey}&format=json&limit=1`),
    ]);

    if (!propsRes.ok) {
      return res.status(200).json({ ok: false, message: `Error de Tokko: ${propsRes.status} — API key inválida o sin permisos` });
    }

    const propsData = await propsRes.json();
    const usersData = usersRes.ok ? await usersRes.json() : null;

    return res.status(200).json({
      ok: true,
      message: "Conexión exitosa con Tokko Broker",
      properties: propsData.meta?.total_count ?? propsData.count ?? 0,
      users: usersData?.meta?.total_count ?? usersData?.count ?? 0,
    });
  } catch (e: any) {
    return res.status(200).json({ ok: false, message: e.message || "Error al conectar con Tokko" });
  }
}
