// pages/api/firmar/[token].ts — Portal público de firma
// Acepta tanto firma_firmantes.firma_token como firma_documentos.firma_token

import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { getAgencyName, enviarEmailFirma } from "../../../lib/firmaEmail";
import { generarPdfConAuditoria, FirmanteDatos } from "../../../lib/firmaAuditPdf";
import { Resend } from "resend";
import { emailWrapperFirma, EMAIL_FROM } from "../../../lib/email";

export const config = { api: { bodyParser: { sizeLimit: "15mb" } }, maxDuration: 60 };

async function getDocAgencyName(usuarioEmail: string): Promise<string> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions").select("name, team_id").eq("email", usuarioEmail).single();
  if (sub?.team_id) {
    const { data: team } = await supabaseAdmin
      .from("teams").select("agency_name, name").eq("id", sub.team_id).single();
    if (team?.agency_name) return team.agency_name;
    if (team?.name) return team.name;
  }
  return sub?.name || "Inmobiliaria";
}

// Resolver token → { doc, firmante }
// Primero busca en firma_firmantes (token del firmante individual)
// Si no, busca en firma_documentos (token legacy / documento completo)
async function resolverToken(token: string) {
  // 1. Buscar en firma_firmantes
  const { data: firmante } = await supabaseAdmin
    .from("firma_firmantes")
    .select(`
      id, nombre, email, rol, estado, firma_token,
      signed_at, dni_frente_url, dni_dorso_url, selfie_url, firma_imagen_url,
      documento_id,
      firma_documentos (
        id, estado, datos_json, expires_at, usuario_email,
        firma_token, firma_plantillas ( nombre )
      )
    `)
    .eq("firma_token", token)
    .single();

  if (firmante?.firma_documentos) {
    const doc = firmante.firma_documentos as unknown as {
      id: string;
      estado: string;
      datos_json: Record<string, string>;
      expires_at: string;
      usuario_email: string;
      firma_token: string;
      firma_plantillas: { nombre?: string } | null;
    };
    return {
      tipo: "firmante" as const,
      firmante,
      doc,
      usuarioEmail: doc.usuario_email,
    };
  }

  // 2. Fallback: buscar en firma_documentos (compatibilidad con docs anteriores)
  const { data: doc } = await supabaseAdmin
    .from("firma_documentos")
    .select(`
      id, estado, firmante_nombre, firmante_email, datos_json,
      firma_token, expires_at, signed_at, usuario_email,
      dni_frente_url, dni_dorso_url, selfie_url, firma_imagen_url,
      plantilla_id, firma_plantillas ( nombre )
    `)
    .eq("firma_token", token)
    .single();

  if (doc) {
    return { tipo: "documento" as const, firmante: null, doc, usuarioEmail: doc.usuario_email };
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query as { token: string };
  if (!token) return res.status(400).json({ error: "Token requerido" });

  // ── GET ─────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const resolved = await resolverToken(token);

    if (!resolved) {
      console.error("Token not found:", token);
      return res.status(404).json({ error: "Documento no encontrado" });
    }

    const { tipo, firmante, doc } = resolved;

    // Verificar vencimiento
    if (doc.expires_at && new Date(doc.expires_at) < new Date()) {
      await supabaseAdmin.from("firma_documentos").update({ estado: "vencido" }).eq("id", doc.id);
      return res.status(410).json({ error: "El link de firma ha vencido" });
    }

    // Si el firmante individual ya firmó
    if (tipo === "firmante" && firmante!.estado === "firmado") {
      return res.json({
        id: doc.id,
        estado: "firmado",
        firmante_nombre: firmante!.nombre,
        firmante_email: firmante!.email,
        nombre_documento: (doc.datos_json as Record<string, string>)?.nombre_documento
          || (doc.firma_plantillas as { nombre?: string } | null)?.nombre || "Documento",
        agency_name: await getDocAgencyName(resolved.usuarioEmail),
        expires_at: doc.expires_at,
        signed_at: firmante!.signed_at,
        tiene_dni: !!(firmante!.dni_frente_url && firmante!.dni_dorso_url),
        tiene_selfie: !!firmante!.selfie_url,
        tiene_firma: !!firmante!.firma_imagen_url,
        datos_formulario: doc.datos_json || {},
      });
    }

    const agencyName = await getDocAgencyName(resolved.usuarioEmail);
    const nombreDocumento = (doc.datos_json as Record<string, string>)?.nombre_documento
      || (doc.firma_plantillas as { nombre?: string } | null)?.nombre
      || "Documento";

    // Usar datos del firmante individual si existe, sino del doc
    const dniFrente = tipo === "firmante" ? firmante!.dni_frente_url : (doc as unknown as Record<string, string>).dni_frente_url;
    const dniDorso  = tipo === "firmante" ? firmante!.dni_dorso_url  : (doc as unknown as Record<string, string>).dni_dorso_url;
    const selfie    = tipo === "firmante" ? firmante!.selfie_url      : (doc as unknown as Record<string, string>).selfie_url;
    const firmaImg  = tipo === "firmante" ? firmante!.firma_imagen_url: (doc as unknown as Record<string, string>).firma_imagen_url;

    return res.json({
      id: doc.id,
      firmante_id: firmante?.id || null,
      estado: tipo === "firmante" ? firmante!.estado : doc.estado,
      firmante_nombre: tipo === "firmante" ? firmante!.nombre : (doc as unknown as Record<string, string>).firmante_nombre,
      firmante_email:  tipo === "firmante" ? firmante!.email  : (doc as unknown as Record<string, string>).firmante_email,
      nombre_documento: nombreDocumento,
      agency_name: agencyName,
      expires_at: doc.expires_at,
      signed_at: tipo === "firmante" ? firmante!.signed_at : (doc as unknown as Record<string, string | null>).signed_at,
      tiene_dni:    !!(dniFrente && dniDorso),
      tiene_dni_frente: !!dniFrente,
      tiene_dni_dorso:  !!dniDorso,
      tiene_selfie: !!selfie,
      tiene_firma:  !!firmaImg,
      datos_formulario: doc.datos_json || {},
    });
  }

  // ── POST — subir imagen ─────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { action } = req.body;

    const resolved = await resolverToken(token);
    if (!resolved) return res.status(404).json({ error: "Documento no encontrado" });

    const { tipo, firmante, doc } = resolved;

    // Verificar que no esté vencido
    if (doc.expires_at && new Date(doc.expires_at) < new Date()) {
      return res.status(410).json({ error: "El link de firma ha vencido" });
    }

    // Verificar que no esté ya firmado
    const yaFirmado = tipo === "firmante" ? firmante!.estado === "firmado" : doc.estado === "firmado";
    if (yaFirmado) return res.status(400).json({ error: "Este documento ya fue firmado" });

    if (action === "subir_imagen") {
      const { tipo: tipoImg, base64, mime } = req.body;
      const tiposValidos = ["dni_frente", "dni_dorso", "selfie", "firma"];
      if (!tiposValidos.includes(tipoImg)) return res.status(400).json({ error: "Tipo inválido" });

      const base64Data = (base64 as string).replace(/^data:[^;]+;base64,/, "");
      let buffer: Buffer = Buffer.from(base64Data, "base64");
      let ext = mime === "image/png" ? "png" : "jpg";

      // Resize antes de guardar — max 1200px, JPEG 82% (excepto firma que va como PNG pequeña)
      try {
        const sharp = (await import("sharp")).default;
        if (tipoImg === "firma") {
          // Firma: mantener PNG pero reducir si es muy grande
          buffer = await sharp(buffer)
            .resize(600, 300, { fit: "inside", withoutEnlargement: true })
            .png({ quality: 90 })
            .toBuffer() as Promise<Buffer>;
          ext = "png";
        } else {
          // DNI frente, dorso, selfie: convertir a JPEG y reducir
          buffer = await sharp(buffer)
            .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 82, mozjpeg: true })
            .toBuffer() as Promise<Buffer>;
          ext = "jpg";
        }
      } catch (e) {
        // Si falla el resize, continuar con el buffer original
        console.warn("Resize falló, usando imagen original:", e);
      }

      // Guardar con ID del firmante si existe, sino del documento
      const storageId = tipo === "firmante" ? `${doc.id}/firmante_${firmante!.id}` : doc.id;
      const path = `${storageId}/${tipoImg}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("firma-docs")
        .upload(path, buffer, { contentType: mime || "image/jpeg", upsert: true });

      if (uploadError) return res.status(500).json({ error: "Error al subir imagen" });

      const { data: signedData } = await supabaseAdmin.storage
        .from("firma-docs")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

      const url = signedData?.signedUrl || path;
      const colMap: Record<string, string> = {
        dni_frente: "dni_frente_url",
        dni_dorso:  "dni_dorso_url",
        selfie:     "selfie_url",
        firma:      "firma_imagen_url",
      };

      // Guardar en el firmante individual o en el documento
      if (tipo === "firmante" && firmante) {
        await supabaseAdmin.from("firma_firmantes").update({ [colMap[tipoImg]]: url }).eq("id", firmante.id);
      } else {
        await supabaseAdmin.from("firma_documentos").update({ [colMap[tipoImg]]: url }).eq("id", doc.id);
      }

      return res.json({ ok: true, url });
    }

    // action === "firmar"
    if (action === "firmar") {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || "";
      const ua = req.headers["user-agent"] || "";

      if (tipo === "firmante" && firmante) {
        // Verificar imágenes del firmante individual
        const { data: fresh } = await supabaseAdmin
          .from("firma_firmantes")
          .select("firma_imagen_url, dni_frente_url, selfie_url")
          .eq("id", firmante.id)
          .single();

        if (!fresh?.firma_imagen_url) return res.status(400).json({ error: "Falta la firma" });
        if (!fresh?.dni_frente_url)   return res.status(400).json({ error: "Falta la foto del DNI" });
        if (!fresh?.selfie_url)       return res.status(400).json({ error: "Falta la selfie" });

        await supabaseAdmin.from("firma_firmantes").update({
          estado: "firmado",
          signed_at: new Date().toISOString(),
          ip_firmante: ip,
          user_agent_firmante: ua,
        }).eq("id", firmante.id);

        // Verificar si todos firmaron (excluyendo el que acaba de firmar)
        const { data: todosFirmantes } = await supabaseAdmin
          .from("firma_firmantes")
          .select("*")
          .eq("documento_id", doc.id);

        const pendientes = (todosFirmantes || []).filter(f => f.id !== firmante.id && f.estado !== "firmado");
        const todosHanFirmado = pendientes.length === 0;

        const agencyName = await getAgencyName(resolved.usuarioEmail);
        const nombreDoc = (doc.datos_json as Record<string,string>)?.nombre_documento
          || (doc.firma_plantillas as {nombre?:string}|null)?.nombre || "Documento";

        if (todosHanFirmado) {
          // Marcar documento como firmado
          await supabaseAdmin.from("firma_documentos")
            .update({ estado: "firmado", signed_at: new Date().toISOString() })
            .eq("id", doc.id);

          // Generar PDF con auditoría de todos los firmantes
          try {
            const firmantesData: FirmanteDatos[] = (todosFirmantes || []).map(f => ({
              nombre: f.nombre || "",
              email: f.email || "",
              telefono: f.telefono,
              rol: f.rol || "Firmante",
              signed_at: f.id === firmante.id ? new Date().toISOString() : f.signed_at,
              ip_firmante: f.id === firmante.id ? ip : f.ip_firmante,
              user_agent: f.id === firmante.id ? ua : f.user_agent_firmante,
              firma_token: f.firma_token,
              firma_imagen_url: f.firma_imagen_url,
              dni_frente_url: f.dni_frente_url,
              dni_dorso_url: f.dni_dorso_url,
              selfie_url: f.selfie_url,
            }));

            // Obtener PDF original
            let pdfOriginalBytes: Uint8Array | null = null;
            const { data: storageFile } = await supabaseAdmin.storage
              .from("firma-docs").download(`${doc.id}/documento_original.pdf`);
            if (storageFile) pdfOriginalBytes = new Uint8Array(await storageFile.arrayBuffer());

            if (!pdfOriginalBytes) {
              const { PDFDocument } = await import("pdf-lib");
              pdfOriginalBytes = await (await PDFDocument.create()).save();
            }

            const pdfFinal = await generarPdfConAuditoria(pdfOriginalBytes, {
              nombre_documento: nombreDoc,
              agency_name: agencyName,
              signed_at: new Date().toISOString(),
              firma_token: doc.firma_token,
              firmantes: firmantesData,
            });

            // Subir PDF final
            const finalPath = `${doc.id}/documento_firmado_final.pdf`;
            await supabaseAdmin.storage.from("firma-docs")
              .upload(finalPath, pdfFinal, { contentType: "application/pdf", upsert: true });
            const { data: signedUrl } = await supabaseAdmin.storage.from("firma-docs")
              .createSignedUrl(finalPath, 60 * 60 * 24 * 365 * 5);
            const pdfUrl = signedUrl?.signedUrl || null;

            await supabaseAdmin.from("firma_documentos")
              .update({ url_documento_firmado: pdfUrl }).eq("id", doc.id);

            const pdfBase64 = Buffer.from(pdfFinal).toString("base64");
            const fileName = `${nombreDoc.replace(/[^a-zA-Z0-9]/g,"_")}_firmado.pdf`;
            const resend = new Resend(process.env.RESEND_API_KEY!);

            // Email a cada firmante con copia
            for (const f of firmantesData) {
              if (!f.email) continue;
              await resend.emails.send({
                from: EMAIL_FROM,
                to: f.email,
                subject: `Tu copia firmada: ${nombreDoc}`,
                html: emailWrapperFirma(`
                  <h2 style="font-size:18px;font-weight:800;color:#111;margin:0 0 8px;">Tu documento firmado</h2>
                  <p style="color:#6b7280;font-size:14px;margin:0 0 16px;line-height:1.6;">
                    Hola <strong>${f.nombre}</strong>, te enviamos tu copia firmada de 
                    <strong>"${nombreDoc}"</strong>. La encontras adjunta a este email.
                  </p>
                  <p style="color:#9ca3af;font-size:11px;text-align:center;">${agencyName}</p>
                `, agencyName),
                attachments: [{ filename: fileName, content: pdfBase64 }],
              }).catch(e => console.error("Email firmante error:", e));
            }

            // Email al inmobiliario con resumen y PDF
            const resumen = firmantesData.map(f =>
              `<tr><td style="padding:6px 10px;font-size:12px;">${f.nombre}</td><td style="padding:6px 10px;font-size:12px;color:#6b7280;">${f.rol||"Firmante"}</td><td style="padding:6px 10px;font-size:12px;color:#065f46;font-weight:700;">Firmado</td></tr>`
            ).join("");

            await resend.emails.send({
              from: EMAIL_FROM,
              to: resolved.usuarioEmail,
              subject: `Todos firmaron: ${nombreDoc}`,
              html: emailWrapperFirma(`
                <h2 style="font-size:18px;font-weight:800;color:#111;margin:0 0 8px;">Documento completamente firmado</h2>
                <p style="color:#6b7280;font-size:14px;margin:0 0 20px;line-height:1.6;">
                  El documento <strong>"${nombreDoc}"</strong> fue firmado por todos los participantes. 
                  Lo encontras adjunto con la pagina de auditoria completa.
                </p>
                <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
                  <thead><tr style="background:#f8fafc;">
                    <th style="padding:8px 10px;font-size:11px;color:#6b7280;text-align:left;">Nombre</th>
                    <th style="padding:8px 10px;font-size:11px;color:#6b7280;text-align:left;">Rol</th>
                    <th style="padding:8px 10px;font-size:11px;color:#6b7280;text-align:left;">Estado</th>
                  </tr></thead>
                  <tbody>${resumen}</tbody>
                </table>
                ${pdfUrl ? `<a href="${pdfUrl}" style="display:block;background:#aa0000;color:#fff;text-align:center;padding:12px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;">Ver documento firmado</a>` : ""}
              `, agencyName),
              attachments: [{ filename: fileName, content: pdfBase64 }],
            }).catch(e => console.error("Email inmobiliario error:", e));

          } catch(e) {
            console.error("Error generando PDF final:", e);
          }

        } else {
          // Firma parcial — avisar al inmobiliario
          const resend = new Resend(process.env.RESEND_API_KEY!);
          const cantPendientes = pendientes.length;
          await resend.emails.send({
            from: EMAIL_FROM,
            to: resolved.usuarioEmail,
            subject: `${firmante.nombre} firmo: ${nombreDoc} (falta${cantPendientes > 1 ? "n" : ""} ${cantPendientes})`,
            html: emailWrapperFirma(`
              <h2 style="font-size:17px;font-weight:800;color:#111;margin:0 0 8px;">Firma parcial registrada</h2>
              <p style="color:#6b7280;font-size:14px;margin:0 0 16px;line-height:1.6;">
                <strong>${firmante.nombre}</strong> firmo el documento <strong>"${nombreDoc}"</strong>.<br/>
                Todavia ${cantPendientes === 1 ? "falta 1 persona" : `faltan ${cantPendientes} personas`} por firmar.
              </p>
              <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                ${(todosFirmantes||[]).map(f => `<tr><td style="padding:8px 10px;font-size:13px;">${f.nombre}</td><td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:700;color:${f.id === firmante.id || f.estado === "firmado" ? "#065f46" : "#92400e"};">${f.id === firmante.id || f.estado === "firmado" ? "Firmado" : "Pendiente"}</td></tr>`).join("")}
              </table>
            `, agencyName),
          }).catch(e => console.error("Email parcial error:", e));
        }

        return res.json({ ok: true, todos_firmaron: todosHanFirmado });

      } else {
        // Documento legacy sin firmantes individuales
        const { data: fresh } = await supabaseAdmin
          .from("firma_documentos")
          .select("firma_imagen_url, dni_frente_url, selfie_url")
          .eq("id", doc.id).single();

        if (!fresh?.firma_imagen_url) return res.status(400).json({ error: "Falta la firma" });
        if (!fresh?.dni_frente_url)   return res.status(400).json({ error: "Falta la foto del DNI" });
        if (!fresh?.selfie_url)       return res.status(400).json({ error: "Falta la selfie" });

        await supabaseAdmin.from("firma_documentos").update({
          estado: "firmado",
          signed_at: new Date().toISOString(),
          ip_firmante: ip,
          user_agent_firmante: ua,
        }).eq("id", doc.id);

        return res.json({ ok: true, todos_firmaron: true });
      }
    }

    return res.status(400).json({ error: "Acción no reconocida" });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
