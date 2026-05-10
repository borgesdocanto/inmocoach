// pages/api/firma/plantillas.ts — ABM de plantillas de firma

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("firma_plantillas")
      .select("*")
      .eq("activo", true)
      .order("nombre");

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  return res.status(405).json({ error: "Método no permitido" });
}
