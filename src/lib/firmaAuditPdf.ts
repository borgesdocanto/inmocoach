// lib/firmaAuditPdf.ts — Genera página de auditoría y la concatena al PDF original

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "pdf-lib";
import * as crypto from "crypto";

export interface DatosAuditoria {
  // Documento
  nombre_documento: string;
  agency_name: string;

  // Firmante
  firmante_nombre: string;
  firmante_email: string;
  firmante_telefono?: string | null;

  // Tracking
  signed_at: string;
  ip_firmante?: string | null;
  user_agent?: string | null;
  firma_token: string;
  submission_id?: number | null;

  // Imágenes (base64 o URLs)
  firma_imagen_url?: string | null;
  dni_frente_url?: string | null;
  dni_dorso_url?: string | null;
  selfie_url?: string | null;
}

// Descargar imagen desde URL y convertir a bytes
async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

// Detectar tipo de imagen
function detectImageType(bytes: Uint8Array): "jpeg" | "png" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  return null;
}

// Hash SHA-256 de los bytes
function sha256(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

// Dibujar línea horizontal
function hline(page: PDFPage, y: number, color = rgb(0.85, 0.85, 0.85)) {
  const { width } = page.getSize();
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color });
}

// Texto truncado
function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}

export async function generarPdfConAuditoria(
  pdfOriginalBytes: Uint8Array,
  datos: DatosAuditoria
): Promise<Uint8Array> {
  // Cargar el PDF original
  const pdfDoc = await PDFDocument.load(pdfOriginalBytes);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const RED = rgb(0.67, 0, 0);       // #aa0000
  const DARK = rgb(0.07, 0.07, 0.07);
  const GRAY = rgb(0.42, 0.42, 0.42);
  const LIGHT = rgb(0.95, 0.95, 0.95);
  const GREEN = rgb(0.02, 0.37, 0.27);
  const WHITE = rgb(1, 1, 1);

  const pageWidth = 595;   // A4
  const pageHeight = 842;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // ── Agregar página de auditoría ─────────────────────────────────────────────
  const auditPage = pdfDoc.addPage([pageWidth, pageHeight]);

  let y = pageHeight - margin;

  // Header rojo
  auditPage.drawRectangle({
    x: 0, y: pageHeight - 70,
    width: pageWidth, height: 70,
    color: RED,
  });

  auditPage.drawText("REGISTRO DE FIRMA ELECTRÓNICA", {
    x: margin, y: pageHeight - 28,
    size: 14, font: helveticaBold, color: WHITE,
  });
  auditPage.drawText(`${datos.agency_name} · InmoCoach`, {
    x: margin, y: pageHeight - 46,
    size: 9, font: helvetica, color: rgb(1, 0.85, 0.85),
  });

  // Badge "VÁLIDO"
  auditPage.drawRectangle({
    x: pageWidth - 110, y: pageHeight - 52,
    width: 70, height: 22,
    color: rgb(0, 0.6, 0.3),
  });
  auditPage.drawText("✓ VÁLIDO", {
    x: pageWidth - 104, y: pageHeight - 44,
    size: 9, font: helveticaBold, color: WHITE,
  });

  y = pageHeight - 90;

  // ── Sección: Documento ──────────────────────────────────────────────────────
  auditPage.drawText("DOCUMENTO", {
    x: margin, y,
    size: 7, font: helveticaBold, color: RED,
  });
  y -= 14;

  auditPage.drawText(truncate(datos.nombre_documento, 80), {
    x: margin, y,
    size: 12, font: helveticaBold, color: DARK,
  });
  y -= 18;

  hline(auditPage, y);
  y -= 16;

  // ── Sección: Firmante ───────────────────────────────────────────────────────
  auditPage.drawText("DATOS DEL FIRMANTE", {
    x: margin, y,
    size: 7, font: helveticaBold, color: RED,
  });
  y -= 14;

  const campos: Array<[string, string]> = [
    ["Nombre completo", datos.firmante_nombre],
    ["Email", datos.firmante_email],
    ...(datos.firmante_telefono ? [["Teléfono", datos.firmante_telefono] as [string, string]] : []),
  ];

  for (const [label, valor] of campos) {
    auditPage.drawText(label, { x: margin, y, size: 8, font: helvetica, color: GRAY });
    auditPage.drawText(truncate(valor, 70), { x: margin + 120, y, size: 8, font: helveticaBold, color: DARK });
    y -= 13;
  }

  hline(auditPage, y);
  y -= 16;

  // ── Sección: Tracking ───────────────────────────────────────────────────────
  auditPage.drawText("REGISTRO DE ACTIVIDAD", {
    x: margin, y,
    size: 7, font: helveticaBold, color: RED,
  });
  y -= 14;

  const fechaFirma = new Date(datos.signed_at).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const trackingItems: Array<[string, string]> = [
    ["Fecha y hora de firma", fechaFirma + " (Argentina, GMT-3)"],
    ["Token de documento", datos.firma_token],
    ...(datos.submission_id ? [["ID DocuSeal", String(datos.submission_id)] as [string, string]] : []),
    ...(datos.ip_firmante ? [["IP del firmante", datos.ip_firmante] as [string, string]] : []),
    ...(datos.user_agent ? [["Dispositivo", truncate(datos.user_agent, 65)] as [string, string]] : []),
  ];

  for (const [label, valor] of trackingItems) {
    auditPage.drawText(label, { x: margin, y, size: 8, font: helvetica, color: GRAY });
    auditPage.drawText(valor, { x: margin + 140, y, size: 7, font: helveticaBold, color: DARK });
    y -= 13;
  }

  hline(auditPage, y);
  y -= 16;

  // ── Sección: Imágenes de verificación ───────────────────────────────────────
  auditPage.drawText("VERIFICACIÓN DE IDENTIDAD", {
    x: margin, y,
    size: 7, font: helveticaBold, color: RED,
  });
  y -= 14;

  const imgSize = 100; // tamaño de cada foto
  const imgGap = 15;
  const imgY = y - imgSize;

  const imageSlots: Array<{ label: string; url: string | null | undefined; x: number }> = [
    { label: "Firma", url: datos.firma_imagen_url, x: margin },
    { label: "DNI Frente", url: datos.dni_frente_url, x: margin + imgSize + imgGap },
    { label: "DNI Dorso", url: datos.dni_dorso_url, x: margin + (imgSize + imgGap) * 2 },
    { label: "Selfie con DNI", url: datos.selfie_url, x: margin + (imgSize + imgGap) * 3 },
  ];

  for (const slot of imageSlots) {
    // Marco de la imagen
    auditPage.drawRectangle({
      x: slot.x, y: imgY,
      width: imgSize, height: imgSize,
      color: LIGHT,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 0.5,
    });

    // Label debajo
    auditPage.drawText(slot.label, {
      x: slot.x + 2, y: imgY - 12,
      size: 7, font: helveticaBold, color: GRAY,
    });

    if (slot.url) {
      const imgBytes = await fetchImageBytes(slot.url);
      if (imgBytes) {
        const imgType = detectImageType(imgBytes);
        const hash = sha256(imgBytes);

        try {
          let embeddedImg;
          if (imgType === "jpeg") {
            embeddedImg = await pdfDoc.embedJpg(imgBytes);
          } else if (imgType === "png") {
            embeddedImg = await pdfDoc.embedPng(imgBytes);
          }

          if (embeddedImg) {
            // Calcular dimensiones manteniendo aspect ratio
            const dims = embeddedImg.scaleToFit(imgSize - 4, imgSize - 4);
            const offsetX = (imgSize - dims.width) / 2;
            const offsetY = (imgSize - dims.height) / 2;

            auditPage.drawImage(embeddedImg, {
              x: slot.x + offsetX + 2,
              y: imgY + offsetY + 2,
              width: dims.width,
              height: dims.height,
            });
          }
        } catch { /* ignorar errores de imagen */ }

        // Hash debajo del label
        auditPage.drawText("SHA256:", {
          x: slot.x, y: imgY - 22,
          size: 5, font: helvetica, color: GRAY,
        });
        auditPage.drawText(hash.slice(0, 32), {
          x: slot.x, y: imgY - 30,
          size: 5, font: helvetica, color: GRAY,
        });
        auditPage.drawText(hash.slice(32), {
          x: slot.x, y: imgY - 38,
          size: 5, font: helvetica, color: GRAY,
        });
      }
    } else {
      auditPage.drawText("Sin imagen", {
        x: slot.x + 20, y: imgY + 45,
        size: 8, font: helvetica, color: GRAY,
      });
    }
  }

  y = imgY - 50;
  hline(auditPage, y);
  y -= 16;

  // ── Hash del documento completo ─────────────────────────────────────────────
  auditPage.drawText("INTEGRIDAD DEL DOCUMENTO", {
    x: margin, y,
    size: 7, font: helveticaBold, color: RED,
  });
  y -= 14;

  const docHash = sha256(pdfOriginalBytes);
  auditPage.drawText("Hash SHA-256 del documento original:", {
    x: margin, y, size: 8, font: helvetica, color: GRAY,
  });
  y -= 12;
  auditPage.drawRectangle({
    x: margin, y: y - 4, width: contentWidth, height: 16,
    color: LIGHT,
  });
  auditPage.drawText(docHash, {
    x: margin + 4, y: y + 1,
    size: 7, font: helvetica, color: DARK,
  });
  y -= 24;

  hline(auditPage, y);
  y -= 16;

  // ── Footer legal ────────────────────────────────────────────────────────────
  const legalText = [
    "Este documento fue firmado electrónicamente mediante InmoCoach. La firma electrónica tiene",
    "plena validez legal según la Ley 25.506 de Firma Digital de la República Argentina.",
    "Los datos de verificación de identidad (DNI, selfie, IP, timestamp) quedan registrados",
    "y son parte integral de este documento como prueba de la manifestación de voluntad del firmante.",
  ];

  auditPage.drawRectangle({
    x: margin, y: y - legalText.length * 11 - 8,
    width: contentWidth, height: legalText.length * 11 + 16,
    color: rgb(0.97, 0.97, 0.97),
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 0.5,
  });

  for (const line of legalText) {
    auditPage.drawText(line, { x: margin + 6, y, size: 7, font: helvetica, color: GRAY });
    y -= 11;
  }

  y -= 16;

  // Número de página y branding
  auditPage.drawText(`Generado por InmoCoach · ${datos.agency_name} · ${new Date().toISOString()}`, {
    x: margin, y: 20,
    size: 6, font: helvetica, color: rgb(0.7, 0.7, 0.7),
  });
  auditPage.drawText(`Página ${pdfDoc.getPageCount()} de ${pdfDoc.getPageCount()}`, {
    x: pageWidth - 80, y: 20,
    size: 6, font: helvetica, color: rgb(0.7, 0.7, 0.7),
  });

  // Serializar el PDF final
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
