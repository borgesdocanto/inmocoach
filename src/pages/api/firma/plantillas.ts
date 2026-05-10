// pages/api/firma/plantillas.ts — ABM de plantillas con multitenancy

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";

async function getTeamId(email: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id")
    .eq("email", email)
    .single();
  return data?.team_id || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session);
  const teamId = await getTeamId(email);

  if (req.method === "GET") {
    let query = supabaseAdmin
      .from("firma_plantillas")
      .select("*")
      .eq("activo", true)
      .order("es_global", { ascending: false })
      .order("nombre");

    if (teamId) {
      query = query.or(`es_global.eq.true,team_id.eq.${teamId}`);
    } else {
      query = query.eq("es_global", true);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === "POST") {
    const { nombre, descripcion, campos, docuseal_template_id } = req.body;
    if (!nombre || !campos) return res.status(400).json({ error: "Nombre y campos son requeridos" });

    const { data, error } = await supabaseAdmin
      .from("firma_plantillas")
      .insert({
        nombre,
        descripcion: descripcion || "",
        campos,
        docuseal_template_id: docuseal_template_id || null,
        team_id: teamId || null,
        es_global: false,
        activo: true,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === "PATCH") {
    const { id, nombre, descripcion, docuseal_template_id, activo } = req.body;
    if (!id) return res.status(400).json({ error: "ID requerido" });

    const { data: plantilla } = await supabaseAdmin
      .from("firma_plantillas")
      .select("team_id, es_global")
      .eq("id", id)
      .single();

    if (!plantilla) return res.status(404).json({ error: "Plantilla no encontrada" });
    if (plantilla.es_global) return res.status(403).json({ error: "No podés editar plantillas del sistema" });
    if (teamId && plantilla.team_id !== teamId) return res.status(403).json({ error: "Sin permisos" });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (nombre !== undefined) updates.nombre = nombre;
    if (descripcion !== undefined) updates.descripcion = descripcion;
    if (docuseal_template_id !== undefined) updates.docuseal_template_id = docuseal_template_id;
    if (activo !== undefined) updates.activo = activo;

    const { data, error } = await supabaseAdmin
      .from("firma_plantillas")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === "DELETE") {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "ID requerido" });

    const { data: plantilla } = await supabaseAdmin
      .from("firma_plantillas")
      .select("team_id, es_global")
      .eq("id", id)
      .single();

    if (!plantilla) return res.status(404).json({ error: "No encontrada" });
    if (plantilla.es_global) return res.status(403).json({ error: "No podés eliminar plantillas del sistema" });
    if (teamId && plantilla.team_id !== teamId) return res.status(403).json({ error: "Sin permisos" });

    await supabaseAdmin.from("firma_plantillas").update({ activo: false }).eq("id", id);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
