// pages/api/firmar/[token]/firmar.ts — Completar firma de un firmante individual

import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../../lib/supabase";
import { getAgencyName } from "../../../../lib/firmaEmail";
import { Resend } from "resend";
import { emailWrapperFirma, EMAIL_FROM } from "../../../../lib/email";

export const config = { api: { bodyParser: true } };

const resend = new Resend(process.env.RESEND_API_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { token } = req.query as { token: string };

  // Buscar firmante por token
  const { data: firmante } = await supabaseAdmin
    .from("firma_firmantes")
    .select("*, firma_documentos(id, usuario_email, datos_json, estado, firma_plantillas(nombre))")
    .eq("firma_token", token)
    .single();

  if (!firmante) return res.status(404).json({ error: "Firmante no encontrado" });
  if (firmante.estado === "firmado") return res.status(400).json({ error: "Ya firmaste este documento" });

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "";
  const ua = req.headers["user-agent"] || "";

  // Marcar firmante como firmado
  await supabaseAdmin
    .from("firma_firmantes")
    .update({
      estado: "firmado",
      signed_at: new Date().toISOString(),
      ip_firmante: ip,
      user_agent_firmante: ua,
    })
    .eq("firma_token", token);

  const doc = firmante.firma_documentos as unknown as {
    id: string;
    usuario_email: string;
    datos_json: Record<string, string>;
    estado: string;
    firma_plantillas: { nombre?: string } | null;
  } | null;

  if (!doc) return res.json({ ok: true });

  // Ver cuántos firmantes quedan pendientes
  const { data: todosFirmantes } = await supabaseAdmin
    .from("firma_firmantes")
    .select("id, nombre, email, rol, estado, signed_at")
    .eq("documento_id", doc.id);

  const pendientes = (todosFirmantes || []).filter(f => f.id !== firmante.id && f.estado !== "firmado");
  const todosHanFirmado = pendientes.length === 0;

  const agencyName = await getAgencyName(doc.usuario_email);
  const nombreDoc = doc.datos_json?.nombre_documento
    || (doc.firma_plantillas as { nombre?: string } | null)?.nombre
    || "Documento";

  if (todosHanFirmado) {
    // Actualizar estado del documento a firmado
    await supabaseAdmin
      .from("firma_documentos")
      .update({ estado: "firmado", signed_at: new Date().toISOString() })
      .eq("id", doc.id);

    // Email al INMOBILIARIO — todos firmaron
    const resumenFirmantes = (todosFirmantes || []).map(f => `
      <tr>
        <td style="padding:8px 12px;font-size:12px;color:#111;border-bottom:1px solid #f3f4f6;">
          ${f.nombre}
        </td>
        <td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6;">
          ${f.rol || "Firmante"}
        </td>
        <td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #f3f4f6;">
          ${f.estado === "firmado"
            ? `<span style="color:#065f46;font-weight:700;">✅ Firmado</span>`
            : `<span style="color:#92400e;">⏳ Pendiente</span>`}
        </td>
        <td style="padding:8px 12px;font-size:11px;color:#9ca3af;border-bottom:1px solid #f3f4f6;">
          ${f.signed_at ? new Date(f.signed_at).toLocaleString("es-AR") : "—"}
        </td>
      </tr>
    `).join("");

    await resend.emails.send({
      from: EMAIL_FROM,
      to: doc.usuario_email,
      subject: `✅ Todos firmaron: ${nombreDoc}`,
      html: emailWrapperFirma(`
        <h2 style="font-size:20px;font-weight:800;color:#111;margin:0 0 6px;">
          ✅ Documento completamente firmado
        </h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px;line-height:1.6;">
          El documento <strong>"${nombreDoc}"</strong> fue firmado por todos los participantes.
        </p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Nombre</th>
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Rol</th>
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Estado</th>
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Fecha</th>
            </tr>
          </thead>
          <tbody>${resumenFirmantes}</tbody>
        </table>

        <a href="https://www.inmocoach.com.ar/firma-digital" style="display:block;background:#aa0000;color:#fff;text-align:center;
          padding:14px;border-radius:12px;font-size:14px;font-weight:800;text-decoration:none;">
          Ver documento en el panel
        </a>
      `, agencyName),
    }).catch(e => console.error("Email todos-firmaron error:", e));

    // Generar PDF final
    fetch(`${process.env.NEXTAUTH_URL}/api/firma/generar-pdf-final`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documento_id: doc.id }),
    }).catch(() => {});

  } else {
    // Email al INMOBILIARIO — aviso parcial
    const nombreFirmante = firmante.nombre;
    const cantidadPendientes = pendientes.length;

    await resend.emails.send({
      from: EMAIL_FROM,
      to: doc.usuario_email,
      subject: `✍ ${nombreFirmante} firmó: ${nombreDoc} (faltan ${cantidadPendientes})`,
      html: emailWrapperFirma(`
        <h2 style="font-size:18px;font-weight:800;color:#111;margin:0 0 6px;">
          ✍ Firma parcial registrada
        </h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 20px;line-height:1.6;">
          <strong>${nombreFirmante}</strong> firmó el documento <strong>"${nombreDoc}"</strong>.<br/>
          Todavía ${cantidadPendientes === 1 ? "falta 1 persona" : `faltan ${cantidadPendientes} personas`} por firmar.
        </p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
          <tbody>
            ${(todosFirmantes || []).map(f => `
              <tr>
                <td style="padding:10px 12px;font-size:13px;color:#111;border-bottom:1px solid #f3f4f6;">
                  <strong>${f.nombre}</strong><br/>
                  <span style="font-size:11px;color:#9ca3af;">${f.rol || "Firmante"}</span>
                </td>
                <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #f3f4f6;">
                  ${f.id === firmante.id || f.estado === "firmado"
                    ? `<span style="color:#065f46;font-weight:700;font-size:12px;">✅ Firmado</span>`
                    : `<span style="color:#92400e;font-size:12px;">⏳ Pendiente</span>`}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `, agencyName),
    }).catch(e => console.error("Email firma-parcial error:", e));
  }

  return res.json({ ok: true, todos_firmaron: todosHanFirmado });
}
