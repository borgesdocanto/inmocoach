// pages/api/webhooks/docuseal.ts — Webhook de DocuSeal para documentos firmados

import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { Resend } from "resend";
import { emailWrapperFirma, EMAIL_FROM } from "../../../lib/email";
import { getAgencyName } from "../../../lib/firmaEmail";
import webpush from "web-push";

export const config = { api: { bodyParser: true } };

const resend = new Resend(process.env.RESEND_API_KEY!);

function emailDocumentoFirmadoHtml(params: {
  destinatario_nombre: string;
  firmante_nombre: string;
  nombre_documento: string;
  agency_name: string;
  pdf_url: string | null;
  es_inmobiliario: boolean;
}): string {
  const { destinatario_nombre, firmante_nombre, nombre_documento, agency_name, pdf_url, es_inmobiliario } = params;

  const titulo = es_inmobiliario
    ? `✅ ${firmante_nombre} firmó el documento`
    : `✅ Firmaste el documento correctamente`;

  const subtitulo = es_inmobiliario
    ? `El documento <strong>${nombre_documento}</strong> fue firmado por <strong>${firmante_nombre}</strong>.`
    : `Firmaste el documento <strong>${nombre_documento}</strong> enviado por <strong>${agency_name}</strong>.`;

  return emailWrapperFirma(`
    <h2 style="font-size:20px;font-weight:800;color:#111;margin:0 0 6px;">${titulo}</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;line-height:1.6;">
      Hola <strong>${destinatario_nombre}</strong>, ${subtitulo}
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="font-size:24px;">✅</span>
        <div>
          <div style="font-size:14px;font-weight:700;color:#065f46;">${nombre_documento}</div>
          <div style="font-size:12px;color:#6b7280;">Firmado el ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
      </div>
    </div>

    ${pdf_url ? `
    <a href="${pdf_url}" style="display:block;background:#aa0000;color:#fff;text-align:center;
      padding:14px;border-radius:12px;font-size:15px;font-weight:800;text-decoration:none;margin-bottom:16px;">
      📄 Descargar documento firmado
    </a>
    ` : `
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;color:#92400e;">
      El documento firmado estará disponible en unos minutos en el panel de firma.
    </div>
    `}

    <p style="color:#9ca3af;font-size:11px;text-align:center;margin:0;">
      ${agency_name}
    </p>
  `, agency_name);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // Responder rápido a DocuSeal para no hacer timeout
  res.json({ ok: true });

  const event = req.body;
  console.log("DocuSeal webhook:", event?.event_type, JSON.stringify(event).slice(0, 300));

  // Manejar submission.completed y submitter.completed
  const eventType = event?.event_type;
  if (eventType !== "submission.completed" && eventType !== "submitter.completed") return;

  const submissionId = event?.data?.submission_id || event?.data?.id;
  if (!submissionId) return;

  // Buscar documento en Supabase
  const { data: doc } = await supabaseAdmin
    .from("firma_documentos")
    .select("*, firma_plantillas(nombre)")
    .eq("docuseal_submission_id", submissionId)
    .single();

  if (!doc) {
    console.log("Webhook: submission no encontrada en DB:", submissionId);
    return;
  }

  // Obtener URL del PDF firmado desde el evento
  let pdfUrl: string | null = null;

  // DocuSeal envía la URL en distintos lugares según el evento
  if (event?.data?.documents?.length > 0) {
    pdfUrl = event.data.documents[0]?.url || null;
  } else if (event?.data?.submission?.documents?.length > 0) {
    pdfUrl = event.data.submission.documents[0]?.url || null;
  }

  // Si no viene en el evento, intentar obtenerla via API
  if (!pdfUrl) {
    try {
      const docusealUrl = process.env.DOCUSEAL_URL;
      const docusealKey = process.env.DOCUSEAL_API_KEY;
      if (docusealUrl && docusealKey) {
        const r = await fetch(`${docusealUrl}/api/submissions/${submissionId}`, {
          headers: { "X-Auth-Token": docusealKey },
        });
        if (r.ok) {
          const sub = await r.json();
          pdfUrl = sub?.documents?.[0]?.url || sub?.submitters?.[0]?.documents?.[0]?.url || null;
        }
      }
    } catch (e) {
      console.error("Error fetching submission from DocuSeal:", e);
    }
  }

  // Solo marcar firmado si submission.completed (no en cada submitter individual)
  const esFirmadoCompleto = eventType === "submission.completed";

  if (esFirmadoCompleto) {
    await supabaseAdmin
      .from("firma_documentos")
      .update({
        estado: "firmado",
        signed_at: new Date().toISOString(),
        url_documento_firmado: pdfUrl,
      })
      .eq("docuseal_submission_id", submissionId);
  }

  // Obtener datos para los emails
  const agencyName = await getAgencyName(doc.usuario_email);
  const nombreDoc = (doc.datos_json as Record<string, string>)?.nombre_documento
    || (doc.firma_plantillas as unknown as { nombre?: string } | null)?.nombre
    || "Documento firmado";

  // Obtener email del inmobiliario
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name")
    .eq("email", doc.usuario_email)
    .single();

  const inmobiliarioEmail = sub?.email || doc.usuario_email;
  const inmobiliarioNombre = sub?.name || agencyName;

  // 1. Email al INMOBILIARIO — aviso de firma + link al PDF
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: inmobiliarioEmail,
      subject: `✅ ${doc.firmante_nombre} firmó: ${nombreDoc}`,
      html: emailDocumentoFirmadoHtml({
        destinatario_nombre: inmobiliarioNombre,
        firmante_nombre: doc.firmante_nombre || "El cliente",
        nombre_documento: nombreDoc,
        agency_name: agencyName,
        pdf_url: pdfUrl,
        es_inmobiliario: true,
      }),
    });
    console.log("Email enviado al inmobiliario:", inmobiliarioEmail);
  } catch (e) {
    console.error("Error email inmobiliario:", e);
  }

  // 2. Email al FIRMANTE — copia del documento firmado
  if (doc.firmante_email && esFirmadoCompleto) {
    try {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: doc.firmante_email,
        subject: `Tu copia: ${nombreDoc}`,
        html: emailDocumentoFirmadoHtml({
          destinatario_nombre: doc.firmante_nombre || "Cliente",
          firmante_nombre: doc.firmante_nombre || "vos",
          nombre_documento: nombreDoc,
          agency_name: agencyName,
          pdf_url: pdfUrl,
          es_inmobiliario: false,
        }),
      });
      console.log("Email copia enviado al firmante:", doc.firmante_email);
    } catch (e) {
      console.error("Error email firmante:", e);
    }
  }

  // 3. Push notification al inmobiliario
  try {
    const { data: pushSubs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("subscription_json")
      .eq("user_email", doc.usuario_email);

    if (pushSubs?.length) {
      const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY || "";
      const vapidEmail = "mailto:coach@inmocoach.com.ar";

      if (vapidPublic && vapidPrivate) {
        webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);
        const payload = JSON.stringify({
          title: "✅ Documento firmado",
          body: `${doc.firmante_nombre} firmó ${nombreDoc}`,
          url: "/firma-digital",
        });
        for (const s of pushSubs) {
          try {
            await webpush.sendNotification(JSON.parse(s.subscription_json), payload);
          } catch { /* push expirada */ }
        }
      }
    }
  } catch (e) {
    console.error("Push error:", e);
  }
}
