// pages/api/firma/subir-pdf.ts — Subir PDF libre para firma via DocuSeal

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { createSubmissionFromPdf, isDocusealConfigured } from "../../../lib/docuseal";
import { enviarEmailFirma, getAgencyName } from "../../../lib/firmaEmail";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

const LIMITE_MENSUAL_FREE = 5;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const email = getEffectiveEmail(req, session);
  if (!email) return res.status(401).json({ error: "No autenticado" });

  const { nombre_documento, firmante_nombre, firmante_email, firmante_telefono, pdf_base64 } = req.body;
  if (!nombre_documento || !firmante_nombre || !firmante_email || !pdf_base64) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
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
      return res.status(403).json({ error: `Límite de ${LIMITE_MENSUAL_FREE} documentos por mes alcanzado` });
    }
  }

  const agencyName = await getAgencyName(email);

  let docuseal_submission_id: number | null = null;
  let docuseal_slug: string | null = null;
  let sign_page_url: string | null = null;

  if (isDocusealConfigured()) {
    try {
      const submissions = await createSubmissionFromPdf({
        name: nombre_documento,
        base64: pdfBase64Clean,
        firmante_nombre,
        firmante_email,
        firmante_telefono: firmante_telefono || undefined,
        send_email: true, // DocuSeal envía el email con el link de firma real
        email_subject: `Firma para ${agencyName}: ${nombre_documento}`,
        email_body: `Hola ${firmante_nombre}, ${agencyName} te envió el documento "${nombre_documento}" para que lo firmes digitalmente.`,
      });
      if (submissions?.[0]) {
        docuseal_submission_id = submissions[0].id;
        docuseal_slug = submissions[0].slug;
        sign_page_url = submissions[0].submitters?.[0]?.sign_page_url || null;
      }
    } catch (err) {
      console.error("DocuSeal error:", err);
      // Fallback: enviar nuestro email con el portal propio
    }
  }

  // Crear documento en Supabase
  const { data: doc, error } = await supabaseAdmin
    .from("firma_documentos")
    .insert({
      usuario_email: email,
      plantilla_id: null,
      datos_json: { nombre_documento },
      firmante_nombre,
      firmante_email,
      firmante_telefono: firmante_telefono || null,
      docuseal_submission_id,
      docuseal_slug,
      team_id: teamId,
      estado: "pendiente",
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("*, firma_plantillas(nombre)")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Si DocuSeal no está disponible → enviar nuestro email con el portal propio
  if (!docuseal_submission_id) {
    await enviarEmailFirma({
      firmante_nombre,
      firmante_email,
      firma_token: doc.firma_token,
      nombre_documento,
      agency_name: agencyName,
    });
  }

  // Guardar PDF original en Storage para generar el PDF final después
  await supabaseAdmin.storage
    .from("firma-docs")
    .upload(`${doc.id}/documento_original.pdf`,
      Buffer.from(pdfBase64Clean, "base64"),
      { contentType: "application/pdf", upsert: true }
    );

  return res.status(201).json({ ...doc, sign_page_url });
}
