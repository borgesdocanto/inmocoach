// lib/firmaEmail.ts — Email centralizado para el portal de firma

import { Resend } from "resend";
import { emailWrapper, EMAIL_FROM } from "./email";
import { supabaseAdmin } from "./supabase";

const resend = new Resend(process.env.RESEND_API_KEY!);
const BASE_URL = process.env.NEXTAUTH_URL || "https://www.inmocoach.com.ar";

export function buildFirmaEmailHtml(params: {
  firmante_nombre: string;
  agency_name: string;
  nombre_documento: string;
  link_firma: string;
}): string {
  const { firmante_nombre, agency_name, nombre_documento, link_firma } = params;
  return emailWrapper(`
    <h2 style="font-size:20px;font-weight:800;color:#111;margin:0 0 6px;">
      Tenés un documento para firmar
    </h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;line-height:1.6;">
      Hola <strong>${firmante_nombre}</strong>, <strong>${agency_name}</strong> te envió 
      el documento <strong>"${nombre_documento}"</strong> para que lo firmes digitalmente.
    </p>

    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="color:#374151;font-size:13px;margin:0 0 10px;font-weight:700;">Para firmar solo necesitás:</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${[
          ["🪪", "Foto del frente y dorso de tu DNI"],
          ["🤳", "Una selfie con el DNI en mano"],
          ["✍️", "Dibujá tu firma en pantalla"],
        ].map(([ico, txt]) => `
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:18px;">${ico}</span>
            <span style="font-size:13px;color:#374151;">${txt}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <a href="${link_firma}" style="display:block;background:#aa0000;color:#fff;text-align:center;
      padding:16px;border-radius:12px;font-size:16px;font-weight:800;text-decoration:none;margin-bottom:16px;">
      ✍ Firmar documento
    </a>

    <p style="color:#9ca3af;font-size:11px;text-align:center;margin:0;line-height:1.6;">
      Si el botón no funciona, copiá este link en tu navegador:<br/>
      <a href="${link_firma}" style="color:#aa0000;word-break:break-all;">${link_firma}</a>
    </p>

    <div style="margin-top:20px;padding:12px 16px;background:#eff6ff;border-radius:8px;font-size:12px;color:#1e40af;">
      🔒 Este link es personal e intransferible. Expira en 30 días.
    </div>
  `);
}

export async function enviarEmailFirma(params: {
  firmante_nombre: string;
  firmante_email: string;
  firma_token: string;
  nombre_documento: string;
  agency_name: string;
}): Promise<{ ok: boolean; error?: string }> {
  const link = `${BASE_URL}/firmar/${params.firma_token}`;

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: params.firmante_email,
    subject: `Firma para ${params.agency_name}: ${params.nombre_documento}`,
    html: buildFirmaEmailHtml({
      firmante_nombre: params.firmante_nombre,
      agency_name: params.agency_name,
      nombre_documento: params.nombre_documento,
      link_firma: link,
    }),
  });

  if (error) {
    console.error("Resend firma error:", error);
    return { ok: false, error: String(error) };
  }
  return { ok: true };
}

// Obtener nombre de la inmobiliaria del usuario
export async function getAgencyName(userEmail: string): Promise<string> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("name, team_id, teams(agency_name, name)")
    .eq("email", userEmail)
    .single();

  const teams = sub?.teams as unknown as { agency_name?: string; name?: string } | null;
  return teams?.agency_name || teams?.name || sub?.name || "InmoCoach";
}
