// pages/api/firma/documentos.ts — CRUD de documentos enviados para firma

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { createSubmission, isDocusealConfigured } from "../../../lib/docuseal";
import { enviarEmailFirma, getAgencyName } from "../../../lib/firmaEmail";

const LIMITE_MENSUAL_FREE = 5;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session);
  if (!email) return res.status(401).json({ error: "No autenticado" });

  const { data: subData } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, plan, status, created_at")
    .eq("email", email)
    .single();
  const teamId = subData?.team_id || null;

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("firma_documentos")
      .select(`*, firma_plantillas (nombre, descripcion)`)
      .eq("usuario_email", email)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === "POST") {
    const { plantilla_id, datos_json, firmante_nombre, firmante_email, firmante_telefono } = req.body;
    if (!plantilla_id || !firmante_email || !firmante_nombre) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    // Verificar límites plan free
    const plan = subData?.plan || "free";
    const isPaidPlan = plan === "individual" || plan === "teams";
    if (!isPaidPlan) {
      const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
      const { count } = await supabaseAdmin
        .from("firma_documentos").select("id", { count: "exact", head: true })
        .eq("usuario_email", email).gte("created_at", inicioMes.toISOString());
      if ((count || 0) >= LIMITE_MENSUAL_FREE) {
        return res.status(403).json({ error: `Plan free: límite de ${LIMITE_MENSUAL_FREE} documentos por mes` });
      }
    }

    const { data: plantilla } = await supabaseAdmin
      .from("firma_plantillas").select("*").eq("id", plantilla_id).single();
    if (!plantilla) return res.status(404).json({ error: "Plantilla no encontrada" });

    let docuseal_submission_id: number | null = null;
    let docuseal_slug: string | null = null;

    if (isDocusealConfigured() && plantilla.docuseal_template_id) {
      try {
        const fields = Object.entries(datos_json || {}).map(([name, value]) => ({
          name, default_value: String(value),
        }));
        const submissions = await createSubmission({
          template_id: plantilla.docuseal_template_id,
          send_email: false, // Nosotros manejamos el email
          submitters: [{ role: "Firmante", name: firmante_nombre, email: firmante_email, fields }],
        });
        if (submissions?.[0]) {
          docuseal_submission_id = submissions[0].id;
          docuseal_slug = submissions[0].slug;
        }
      } catch (err) {
        console.error("DocuSeal error:", err);
      }
    }

    // Crear documento en Supabase
    const { data: doc, error } = await supabaseAdmin
      .from("firma_documentos")
      .insert({
        usuario_email: email,
        plantilla_id,
        datos_json: datos_json || {},
        firmante_nombre,
        firmante_email,
        firmante_telefono: firmante_telefono || null,
        docuseal_submission_id,
        docuseal_slug,
        team_id: teamId,
        estado: "pendiente",
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select(`*, firma_plantillas(nombre)`)
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Enviar email con link del portal público
    const agencyName = await getAgencyName(email);
    const nombreDoc = plantilla.nombre;
    await enviarEmailFirma({
      firmante_nombre,
      firmante_email,
      firma_token: doc.firma_token,
      nombre_documento: nombreDoc,
      agency_name: agencyName,
    });

    return res.status(201).json(doc);
  }

  return res.status(405).json({ error: "Método no permitido" });
}
