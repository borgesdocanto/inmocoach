// pages/api/firma/documentos.ts

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { isDocusealConfigured } from "../../../lib/docuseal";
import { enviarEmailFirma, getAgencyName } from "../../../lib/firmaEmail";

const LIMITE_MENSUAL_FREE = 5;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session);
  if (!email) return res.status(401).json({ error: "No autenticado" });

  const { data: subData } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, plan")
    .eq("email", email)
    .single();
  const teamId = subData?.team_id || null;

  // GET — listar documentos con firmantes
  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("firma_documentos")
      .select(`
        *,
        firma_plantillas (nombre, descripcion),
        firma_firmantes (id, nombre, email, rol, orden, estado, signed_at, firma_token, email_enviado_at)
      `)
      .eq("usuario_email", email)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // POST — crear documento con múltiples firmantes
  if (req.method === "POST") {
    const { plantilla_id, datos_json, firmantes } = req.body;
    // firmantes: [{ nombre, email, telefono, rol, orden }]

    if (!plantilla_id || !firmantes?.length) {
      return res.status(400).json({ error: "Plantilla y al menos un firmante son obligatorios" });
    }

    // Validar firmantes
    for (const f of firmantes) {
      if (!f.nombre || !f.email) {
        return res.status(400).json({ error: "Cada firmante debe tener nombre y email" });
      }
    }

    // Límite plan free
    const plan = subData?.plan || "free";
    const isPaidPlan = plan === "individual" || plan === "teams";
    if (!isPaidPlan) {
      const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
      const { count } = await supabaseAdmin
        .from("firma_documentos").select("id", { count: "exact", head: true })
        .eq("usuario_email", email).gte("created_at", inicioMes.toISOString());
      if ((count || 0) >= LIMITE_MENSUAL_FREE) {
        return res.status(403).json({ error: `Límite de ${LIMITE_MENSUAL_FREE} documentos por mes alcanzado` });
      }
    }

    const { data: plantilla } = await supabaseAdmin
      .from("firma_plantillas").select("*").eq("id", plantilla_id).single();
    if (!plantilla) return res.status(404).json({ error: "Plantilla no encontrada" });

    const agencyName = await getAgencyName(email);

    // Crear documento padre
    const { data: doc, error: docErr } = await supabaseAdmin
      .from("firma_documentos")
      .insert({
        usuario_email: email,
        plantilla_id,
        datos_json: datos_json || {},
        team_id: teamId,
        estado: "pendiente",
        // Compatibilidad: primer firmante en campos legacy
        firmante_nombre: firmantes[0].nombre,
        firmante_email: firmantes[0].email,
        firmante_telefono: firmantes[0].telefono || null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (docErr || !doc) return res.status(500).json({ error: docErr?.message || "Error al crear documento" });

    // Crear firmantes individuales
    const firmantesData = firmantes.map((f: { nombre: string; email: string; telefono?: string; rol?: string; orden?: number }, i: number) => ({
      documento_id: doc.id,
      nombre: f.nombre,
      email: f.email,
      telefono: f.telefono || null,
      rol: f.rol || "Firmante",
      orden: f.orden || (i + 1),
      estado: "pendiente",
    }));

    const { data: firmantesCreados, error: firmErr } = await supabaseAdmin
      .from("firma_firmantes")
      .insert(firmantesData)
      .select();

    if (firmErr) return res.status(500).json({ error: firmErr.message });

    // Enviar email a cada firmante
    const nombreDoc = plantilla.nombre;
    for (const firmante of firmantesCreados || []) {
      await enviarEmailFirma({
        firmante_nombre: firmante.nombre,
        firmante_email: firmante.email,
        firma_token: firmante.firma_token,
        nombre_documento: nombreDoc,
        agency_name: agencyName,
        rol_firmante: firmante.rol,
        total_firmantes: firmantesCreados!.length,
      }).catch(e => console.error("Email firmante error:", e));

      // Marcar email enviado
      await supabaseAdmin
        .from("firma_firmantes")
        .update({ email_enviado_at: new Date().toISOString() })
        .eq("id", firmante.id);
    }

    return res.status(201).json({ ...doc, firma_firmantes: firmantesCreados });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
