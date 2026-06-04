// pages/api/firma/subir-pdf.ts — Subir PDF libre con múltiples firmantes

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { createSubmissionFromPdf, isDocusealConfigured } from "../../../lib/docuseal";
import { enviarEmailFirma, getAgencyName } from "../../../lib/firmaEmail";

export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };

const LIMITE_MENSUAL_FREE = 5;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session);
  if (!email) return res.status(401).json({ error: "No autenticado" });

  const { nombre_documento, firmantes, pdf_base64 } = req.body;
  // firmantes: [{ nombre, email, telefono, rol }]

  if (!nombre_documento || !firmantes?.length || !pdf_base64) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  for (const f of firmantes) {
    if (!f.nombre || !f.email) {
      return res.status(400).json({ error: "Cada firmante debe tener nombre y email" });
    }
  }

  const pdfBase64Clean = pdf_base64.replace(/^data:application\/pdf;base64,/, "");
  if (!pdfBase64Clean.startsWith("JVBER")) {
    return res.status(400).json({ error: "El archivo debe ser un PDF válido" });
  }

  const { data: subData } = await supabaseAdmin
    .from("subscriptions").select("plan, team_id").eq("email", email).single();
  const plan = subData?.plan || "free";
  const teamId = subData?.team_id || null;
  const isPaidPlan = plan === "individual" || plan === "teams";

  if (!isPaidPlan) {
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("firma_documentos").select("id", { count: "exact", head: true })
      .eq("usuario_email", email).gte("created_at", inicioMes.toISOString());
    if ((count || 0) >= LIMITE_MENSUAL_FREE) {
      return res.status(403).json({ error: `Límite de ${LIMITE_MENSUAL_FREE} documentos por mes` });
    }
  }

  const agencyName = await getAgencyName(email);
  const primerFirmante = firmantes[0];

  // DocuSeal — solo con el primer firmante por ahora (no soporta múltiples en el mismo flow)
  let docuseal_submission_id: number | null = null;
  let docuseal_slug: string | null = null;

  if (isDocusealConfigured() && firmantes.length === 1) {
    try {
      const submissions = await createSubmissionFromPdf({
        name: nombre_documento,
        base64: pdfBase64Clean,
        firmante_nombre: primerFirmante.nombre,
        firmante_email: primerFirmante.email,
        firmante_telefono: primerFirmante.telefono || undefined,
        send_email: false,
      });
      if (submissions?.[0]) {
        docuseal_submission_id = submissions[0].id;
        docuseal_slug = submissions[0].slug;
      }
    } catch (err) {
      console.error("DocuSeal error:", err);
    }
  }

  // Crear documento padre
  const { data: doc, error } = await supabaseAdmin
    .from("firma_documentos")
    .insert({
      usuario_email: email,
      plantilla_id: null,
      datos_json: { nombre_documento },
      firmante_nombre: primerFirmante.nombre,
      firmante_email: primerFirmante.email,
      firmante_telefono: primerFirmante.telefono || null,
      docuseal_submission_id,
      docuseal_slug,
      team_id: teamId,
      estado: "pendiente",
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("*, firma_plantillas(nombre)")
    .single();

  if (error || !doc) return res.status(500).json({ error: error?.message || "Error al crear documento" });

  // Guardar PDF original en Storage
  await supabaseAdmin.storage
    .from("firma-docs")
    .upload(`${doc.id}/documento_original.pdf`,
      Buffer.from(pdfBase64Clean, "base64"),
      { contentType: "application/pdf", upsert: true }
    );

  // Crear firmantes individuales
  const firmantesData = firmantes.map((f: { nombre: string; email: string; telefono?: string; rol?: string }, i: number) => ({
    documento_id: doc.id,
    nombre: f.nombre,
    email: f.email,
    telefono: f.telefono || null,
    rol: f.rol || "Firmante",
    orden: i + 1,
    estado: "pendiente",
  }));

  const { data: firmantesCreados } = await supabaseAdmin
    .from("firma_firmantes")
    .insert(firmantesData)
    .select();

  // Enviar email a cada firmante
  for (const firmante of firmantesCreados || []) {
    await enviarEmailFirma({
      firmante_nombre: firmante.nombre,
      firmante_email: firmante.email,
      firma_token: firmante.firma_token,
      nombre_documento,
      agency_name: agencyName,
      rol_firmante: firmante.rol,
      total_firmantes: firmantesCreados!.length,
    }).catch(e => console.error("Email error:", e));

    await supabaseAdmin
      .from("firma_firmantes")
      .update({ email_enviado_at: new Date().toISOString() })
      .eq("id", firmante.id);
  }

  return res.status(201).json({ ...doc, firma_firmantes: firmantesCreados });
}
