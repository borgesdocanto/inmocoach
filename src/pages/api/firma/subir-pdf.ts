// pages/api/firma/subir-pdf.ts — Subir PDF libre para firma (sin plantilla)

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { getEffectiveEmail } from "../../../lib/impersonation";
import { createSubmissionFromPdf, isDocusealConfigured } from "../../../lib/docuseal";
import { Resend } from "resend";
import { emailWrapper, EMAIL_FROM } from "../../../lib/email";

// PDF puede ser grande — aumentar límite del body
export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

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

  // Validar que sea base64 de PDF (empieza con JVBERi0 = "%PDF-" en base64)
  const pdfBase64Clean = pdf_base64.replace(/^data:application\/pdf;base64,/, "");
  if (!pdfBase64Clean.startsWith("JVBER")) {
    return res.status(400).json({ error: "El archivo debe ser un PDF válido" });
  }

  // Verificar plan y límites
  const { data: subData } = await supabaseAdmin
    .from("subscriptions")
    .select("plan, team_id")
    .eq("email", email)
    .single();

  const plan = subData?.plan || "free";
  const teamId = subData?.team_id || null;
  const isPaidPlan = plan === "individual" || plan === "teams";

  if (!isPaidPlan) {
    const inicioMes = new Date();
    inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("firma_documentos")
      .select("id", { count: "exact", head: true })
      .eq("usuario_email", email)
      .gte("created_at", inicioMes.toISOString());
    if ((count || 0) >= LIMITE_MENSUAL_FREE) {
      return res.status(403).json({
        error: `Plan free: límite de ${LIMITE_MENSUAL_FREE} documentos por mes alcanzado`,
      });
    }
  }

  let docuseal_submission_id: number | null = null;
  let docuseal_slug: string | null = null;

  if (isDocusealConfigured()) {
    try {
      const submissions = await createSubmissionFromPdf({
        name: nombre_documento,
        base64: pdfBase64Clean,
        firmante_nombre,
        firmante_email,
        firmante_telefono: firmante_telefono || undefined,
        send_email: true,
      });
      if (submissions?.[0]) {
        docuseal_submission_id = submissions[0].id;
        docuseal_slug = submissions[0].slug;
      }
    } catch (err) {
      console.error("DocuSeal PDF upload error:", err);
      // Continuar sin DocuSeal
    }
  }

  // Guardar en Supabase
  const { data: doc, error } = await supabaseAdmin
    .from("firma_documentos")
    .insert({
      usuario_email: email,
      plantilla_id: null, // sin plantilla
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

  // Si no hay DocuSeal, enviar email via Resend con el link de firma
  if (!docuseal_submission_id) {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const { data: sub } = await supabaseAdmin
      .from("subscriptions").select("name").eq("email", email).single();
    const inmobiliarioNombre = sub?.name || "Tu inmobiliario";

    await resend.emails.send({
      from: EMAIL_FROM,
      to: firmante_email,
      subject: `Documento para firmar: ${nombre_documento}`,
      html: emailWrapper(`
        <h2 style="font-size:18px;font-weight:700;color:#111;margin:0 0 8px;">
          Tenés un documento para firmar
        </h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">
          Hola <strong>${firmante_nombre}</strong>, <strong>${inmobiliarioNombre}</strong> te envió 
          <strong>${nombre_documento}</strong> para que lo firmes digitalmente.
        </p>
        <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
          <p style="color:#374151;font-size:13px;margin:0 0 4px;font-weight:600;">Próximos pasos</p>
          <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.7;">
            Tu inmobiliario se va a contactar con vos para coordinar la firma del documento 
            <strong>${nombre_documento}</strong>. Si tenés consultas, respondé este email 
            o contactá a ${inmobiliarioNombre} directamente.
          </p>
        </div>
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:20px;">
          Enviado desde InmoCoach · ${inmobiliarioNombre}
        </p>
      `),
    }).catch(err => console.error("Resend error en subir-pdf:", err));
  }

  return res.status(201).json(doc);
}
