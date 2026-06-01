// lib/firmaAuditPdf.ts — Genera página de auditoría con múltiples firmantes

import { PDFDocument, rgb, StandardFonts, PDFPage } from "pdf-lib";
import * as crypto from "crypto";

export interface FirmanteDatos {
  nombre: string;
  email: string;
  telefono?: string | null;
  rol?: string;
  signed_at?: string | null;
  ip_firmante?: string | null;
  user_agent?: string | null;
  firma_token: string;
  firma_imagen_url?: string | null;
  dni_frente_url?: string | null;
  dni_dorso_url?: string | null;
  selfie_url?: string | null;
}

export interface DatosAuditoria {
  nombre_documento: string;
  agency_name: string;
  signed_at: string;
  firma_token: string;
  submission_id?: number | null;
  firmantes: FirmanteDatos[];
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch { return null; }
}

function detectImageType(bytes: Uint8Array): "jpeg" | "png" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  return null;
}

function sha256(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function safe(str: string): string {
  return (str || "")
    .replace(/á/g,"a").replace(/é/g,"e").replace(/í/g,"i")
    .replace(/ó/g,"o").replace(/ú/g,"u").replace(/ü/g,"u")
    .replace(/Á/g,"A").replace(/É/g,"E").replace(/Í/g,"I")
    .replace(/Ó/g,"O").replace(/Ú/g,"U").replace(/Ü/g,"U")
    .replace(/ñ/g,"n").replace(/Ñ/g,"N")
    .replace(/[^\x00-\xFF]/g,"?");
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function hline(page: PDFPage, y: number) {
  const { width } = page.getSize();
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
}

async function dibujarFirmante(
  pdfDoc: PDFDocument,
  page: PDFPage,
  firmante: FirmanteDatos,
  yStart: number,
  numero: number,
  total: number,
  margin: number,
  contentWidth: number
): Promise<number> {
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const RED  = rgb(0.67, 0, 0);
  const DARK = rgb(0.07, 0.07, 0.07);
  const GRAY = rgb(0.42, 0.42, 0.42);
  const LIGHT= rgb(0.95, 0.95, 0.95);
  const GREEN= rgb(0, 0.6, 0.3);
  const WHITE= rgb(1,1,1);

  let y = yStart;

  // Header del firmante con número
  const headerLabel = total > 1
    ? safe(`FIRMANTE ${numero} DE ${total}: ${firmante.rol || "Firmante"}`)
    : safe("DATOS DEL FIRMANTE");
  page.drawText(headerLabel, { x: margin, y, size: 7, font: helveticaBold, color: RED });
  y -= 14;

  // Info básica
  const infos: Array<[string, string]> = [
    ["Nombre", firmante.nombre],
    ["Email", firmante.email],
    ...(firmante.telefono ? [["Telefono", firmante.telefono] as [string,string]] : []),
    ...(firmante.signed_at ? [["Firmo el", new Date(firmante.signed_at).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day:"2-digit", month:"2-digit", year:"numeric",
      hour:"2-digit", minute:"2-digit"
    })] as [string,string]] : []),
    ...(firmante.ip_firmante ? [["IP", firmante.ip_firmante] as [string,string]] : []),
    ["Hash", safe(truncate(firmante.firma_token, 50))],
  ];

  for (const [label, valor] of infos) {
    page.drawText(safe(label), { x: margin, y, size: 7.5, font: helvetica, color: GRAY });
    page.drawText(safe(truncate(valor, 65)), { x: margin + 110, y, size: 7.5, font: helveticaBold, color: DARK });
    y -= 12;
  }

  y -= 6;

  // Imágenes del firmante
  const imgSize = 95;
  const imgGap = 12;
  const imgY = y - imgSize;

  const slots: Array<{ label: string; url: string | null | undefined; x: number }> = [
    { label: "Firma", url: firmante.firma_imagen_url, x: margin },
    { label: "DNI Frente", url: firmante.dni_frente_url, x: margin + imgSize + imgGap },
    { label: "DNI Dorso", url: firmante.dni_dorso_url, x: margin + (imgSize + imgGap) * 2 },
    { label: "Selfie", url: firmante.selfie_url, x: margin + (imgSize + imgGap) * 3 },
  ];

  for (const slot of slots) {
    // Marco
    page.drawRectangle({ x: slot.x, y: imgY, width: imgSize, height: imgSize, color: LIGHT, borderColor: rgb(0.8,0.8,0.8), borderWidth: 0.5 });
    page.drawText(safe(slot.label), { x: slot.x + 2, y: imgY - 10, size: 6.5, font: helveticaBold, color: GRAY });

    if (slot.url) {
      const imgBytes = await fetchImageBytes(slot.url);
      if (imgBytes) {
        const imgType = detectImageType(imgBytes);
        const hash = sha256(imgBytes);
        try {
          const embedded = imgType === "jpeg"
            ? await pdfDoc.embedJpg(imgBytes)
            : imgType === "png" ? await pdfDoc.embedPng(imgBytes) : null;
          if (embedded) {
            const dims = embedded.scaleToFit(imgSize - 4, imgSize - 4);
            page.drawImage(embedded, {
              x: slot.x + (imgSize - dims.width) / 2 + 2,
              y: imgY + (imgSize - dims.height) / 2 + 2,
              width: dims.width, height: dims.height,
            });
          }
        } catch { /* ignorar */ }
        // Hash mini
        page.drawText(safe(hash.slice(0, 30)), { x: slot.x, y: imgY - 19, size: 4.5, font: helvetica, color: rgb(0.6,0.6,0.6) });
        page.drawText(safe(hash.slice(30, 60)), { x: slot.x, y: imgY - 25, size: 4.5, font: helvetica, color: rgb(0.6,0.6,0.6) });
      }
    } else {
      page.drawText(safe("Sin imagen"), { x: slot.x + 18, y: imgY + 44, size: 7, font: helvetica, color: GRAY });
    }
  }

  y = imgY - 32;
  return y;
}

export async function generarPdfConAuditoria(
  pdfOriginalBytes: Uint8Array,
  datos: DatosAuditoria
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfOriginalBytes);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const RED  = rgb(0.67, 0, 0);
  const DARK = rgb(0.07, 0.07, 0.07);
  const GRAY = rgb(0.42, 0.42, 0.42);
  const LIGHT= rgb(0.95, 0.95, 0.95);
  const WHITE= rgb(1,1,1);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // Normalizar firmantes — si no viene array, construir desde campos legacy
  const firmantes: FirmanteDatos[] = datos.firmantes?.length > 0 ? datos.firmantes : [];

  // ── Footer en cada hoja del documento original ────────────────────────────────
  const fechaCierre = datos.signed_at
    ? new Date(datos.signed_at).toLocaleDateString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        day: "2-digit", month: "2-digit", year: "numeric"
      })
    : new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" });

  const footerText = safe(
    `Firmado electronicamente · Token: ${datos.firma_token} · ${fechaCierre} · Ley 25.506 Argentina`
  );

  const pagesCount = pdfDoc.getPageCount();
  for (let i = 0; i < pagesCount; i++) {
    const page = pdfDoc.getPage(i);
    const { width } = page.getSize();
    // Línea separadora sutil
    page.drawLine({
      start: { x: 30, y: 22 },
      end: { x: width - 30, y: 22 },
      thickness: 0.3,
      color: rgb(0.75, 0.75, 0.75),
    });
    // Texto del footer centrado
    page.drawText(footerText, {
      x: 30,
      y: 10,
      size: 6.5,
      font: helvetica,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  // ── Página de auditoría ──────────────────────────────────────────────────────
  const auditPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Header rojo
  auditPage.drawRectangle({ x: 0, y: pageHeight - 70, width: pageWidth, height: 70, color: RED });
  auditPage.drawText(safe("REGISTRO DE FIRMA ELECTRONICA"), { x: margin, y: pageHeight - 28, size: 14, font: helveticaBold, color: WHITE });
  auditPage.drawText(safe(datos.agency_name), { x: margin, y: pageHeight - 46, size: 9, font: helvetica, color: rgb(1, 0.85, 0.85) });

  // Badge FIRMADO
  auditPage.drawRectangle({ x: pageWidth - 120, y: pageHeight - 54, width: 80, height: 24, color: rgb(0, 0.6, 0.3) });
  auditPage.drawText("FIRMADO", { x: pageWidth - 111, y: pageHeight - 46, size: 10, font: helveticaBold, color: WHITE });

  y = pageHeight - 90;

  // Documento
  auditPage.drawText(safe("DOCUMENTO"), { x: margin, y, size: 7, font: helveticaBold, color: RED });
  y -= 14;
  auditPage.drawText(safe(truncate(datos.nombre_documento, 80)), { x: margin, y, size: 12, font: helveticaBold, color: DARK });
  y -= 16;

  // Info general
  const infoGeneral: Array<[string, string]> = [
    ["Token documento", datos.firma_token],
    ...(datos.submission_id ? [["ID DocuSeal", String(datos.submission_id)] as [string,string]] : []),
    ["Completado", new Date(datos.signed_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) + " (Argentina)"],
    ["Total firmantes", String(firmantes.length)],
  ];
  for (const [label, valor] of infoGeneral) {
    auditPage.drawText(safe(label), { x: margin, y, size: 7.5, font: helvetica, color: GRAY });
    auditPage.drawText(safe(valor), { x: margin + 130, y, size: 7.5, font: helveticaBold, color: DARK });
    y -= 12;
  }

  hline(auditPage, y - 4);
  y -= 18;

  // ── Firmantes individuales ────────────────────────────────────────────────────
  // Cada firmante necesita: datos (~80px) + fotos (~130px) + separador (~20px) = ~230px mínimo
  const ESPACIO_FIRMANTE = 240;
  let currentPage = auditPage;

  for (let i = 0; i < firmantes.length; i++) {
    const firmante = firmantes[i];

    // Crear nueva página si no hay espacio suficiente
    if (y < ESPACIO_FIRMANTE) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      // Mini header en páginas de continuación
      currentPage.drawRectangle({ x: 0, y: pageHeight - 28, width: pageWidth, height: 28, color: RED });
      currentPage.drawText(safe("REGISTRO DE FIRMA ELECTRONICA · " + datos.agency_name), {
        x: margin, y: pageHeight - 19, size: 8, font: helveticaBold, color: WHITE
      });
      y = pageHeight - 40;
    }

    y = await dibujarFirmante(pdfDoc, currentPage, firmante, y, i + 1, firmantes.length, margin, contentWidth);

    if (i < firmantes.length - 1) {
      hline(currentPage, y - 4);
      y -= 18;
    }
  }

  // ── Hash del documento ────────────────────────────────────────────────────────
  // Usar siempre la última página real y crear nueva si hace falta
  let hashPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
  let yLast = y - 16;

  if (yLast < 100) {
    hashPage = pdfDoc.addPage([pageWidth, pageHeight]);
    yLast = pageHeight - margin;
  }

  hline(hashPage, yLast - 4);
  yLast -= 18;
  hashPage.drawText(safe("INTEGRIDAD DEL DOCUMENTO"), { x: margin, y: yLast, size: 7, font: helveticaBold, color: RED });
  yLast -= 14;
  const docHash = sha256(pdfOriginalBytes);
  hashPage.drawText(safe("Hash SHA-256:"), { x: margin, y: yLast, size: 7.5, font: helvetica, color: GRAY });
  hashPage.drawRectangle({ x: margin + 90, y: yLast - 4, width: contentWidth - 90, height: 14, color: LIGHT });
  hashPage.drawText(safe(docHash), { x: margin + 94, y: yLast, size: 6, font: helvetica, color: DARK });
  yLast -= 20;

  const legal = ["Firmado electronicamente segun Ley 25.506 de Firma Digital - Republica Argentina."];
  hashPage.drawRectangle({ x: margin, y: yLast - 14, width: contentWidth, height: 18, color: rgb(0.97,0.97,0.97), borderColor: rgb(0.85,0.85,0.85), borderWidth: 0.5 });
  hashPage.drawText(safe(legal[0]), { x: margin + 6, y: yLast - 2, size: 7, font: helvetica, color: GRAY });
  hashPage.drawText(safe(`${datos.agency_name} · ${new Date().toISOString()}`), { x: margin, y: 20, size: 6, font: helvetica, color: rgb(0.7,0.7,0.7) });

  return pdfDoc.save();
}
