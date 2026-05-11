import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Head from "next/head";
import AppLayout from "../components/AppLayout";
import {
  FileSignature, Plus, Clock, CheckCircle2, XCircle, RefreshCw,
  ChevronRight, Send, X, AlertCircle, FileText, Phone, Mail,
  Settings, Globe, Building2, Pencil, Trash2, ExternalLink, Upload, Download
} from "lucide-react";

const RED = "#aa0000";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CampoPlantilla {
  nombre: string;
  etiqueta: string;
  tipo: "text" | "number" | "date" | "textarea" | "select";
  opciones?: string[];
  requerido: boolean;
}

interface Plantilla {
  id: string;
  nombre: string;
  descripcion: string;
  campos: CampoPlantilla[];
  docuseal_template_id: number | null;
  es_global: boolean;
  team_id: string | null;
}

interface Firmante {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  orden: number;
  estado: "pendiente" | "firmado" | "rechazado";
  signed_at: string | null;
  firma_token: string;
  email_enviado_at: string | null;
}

interface Documento {
  id: string;
  firma_token: string;
  plantilla_id: string;
  estado: "pendiente" | "firmado" | "vencido" | "cancelado";
  datos_json: Record<string, string>;
  firmante_nombre: string;
  firmante_email: string;
  firmante_telefono: string | null;
  created_at: string;
  signed_at: string | null;
  expires_at: string;
  firma_plantillas: { nombre: string; descripcion: string } | null;
  docuseal_submission_id: number | null;
  url_documento_firmado: string | null;
  firma_firmantes?: Firmante[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Estado del documento según firmantes: pendiente=naranja, parcial=amarillo, firmado=verde
function calcularEstadoVisual(doc: Documento): { label: string; color: string; bg: string; border: string } {
  const firmantes = doc.firma_firmantes || [];
  const firmados = firmantes.filter(f => f.estado === "firmado").length;
  const total = firmantes.length;

  if (doc.estado === "cancelado") return { label: "Cancelado", color: "#374151", bg: "#f3f4f6", border: "#e5e7eb" };
  if (doc.estado === "vencido")   return { label: "Vencido",   color: "#991b1b", bg: "#fee2e2", border: "#fca5a5" };

  // Con firmantes individuales
  if (total > 0) {
    if (firmados === 0) return { label: "Pendiente",   color: "#9a3412", bg: "#ffedd5", border: "#fdba74" }; // naranja
    if (firmados < total) return { label: `${firmados}/${total} firmaron`, color: "#854d0e", bg: "#fef9c3", border: "#fde047" }; // amarillo
    return { label: "Completado", color: "#065f46", bg: "#d1fae5", border: "#6ee7b7" }; // verde
  }

  // Sin firmantes individuales (legacy)
  if (doc.estado === "firmado")   return { label: "Firmado",   color: "#065f46", bg: "#d1fae5", border: "#6ee7b7" };
  return { label: "Pendiente", color: "#9a3412", bg: "#ffedd5", border: "#fdba74" };
}

function estadoBadge(doc: Documento) {
  const e = calcularEstadoVisual(doc);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: e.bg, color: e.color, border: `1px solid ${e.border}`,
      fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999
    }}>
      {e.label}
    </span>
  );
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function esPendienteMasDe48h(doc: Documento) {
  if (doc.estado !== "pendiente") return false;
  return Date.now() - new Date(doc.created_at).getTime() > 48 * 60 * 60 * 1000;
}

// ─── Modal genérico centrado ───────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.55)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px"
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, padding: 24,
        width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,.25)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{title}</div>
          <button onClick={onClose} style={{
            background: "#f3f4f6", border: "none", borderRadius: 8,
            width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <X size={16} color="#6b7280" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Selector de plantilla ─────────────────────────────────────────────────────

function SelectorPlantilla({
  plantillas,
  onSelect,
  onSubirPdf,
}: {
  plantillas: Plantilla[];
  onSelect: (p: Plantilla) => void;
  onSubirPdf: () => void;
}) {
  const globales = plantillas.filter(p => p.es_global);
  const propias = plantillas.filter(p => !p.es_global);

  const GrupoPlantillas = ({ lista, label }: { lista: Plantilla[]; label: string }) => (
    lista.length > 0 ? (
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {lista.map(p => (
            <button key={p.id} onClick={() => onSelect(p)} style={{
              width: "100%", background: "#fff", border: "1.5px solid #e5e7eb",
              borderRadius: 12, padding: "13px 15px", textAlign: "left",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
              transition: "all .15s"
            }}
              onMouseOver={e => { e.currentTarget.style.borderColor = RED; e.currentTarget.style.background = "#fff8f8"; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#fff"; }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111", display: "flex", alignItems: "center", gap: 6 }}>
                  {p.nombre}
                  {p.es_global
                    ? <Globe size={11} color="#9ca3af" />
                    : <Building2 size={11} color="#0ea5e9" />}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{p.descripcion}</div>
              </div>
              <ChevronRight size={15} color="#9ca3af" />
            </button>
          ))}
        </div>
      </div>
    ) : null
  );

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 16 }}>
        Elegí el tipo de documento
      </div>

      {/* Opción: subir PDF propio */}
      <button onClick={onSubirPdf} style={{
        width: "100%", background: "#fff8f8", border: `2px solid ${RED}`,
        borderRadius: 12, padding: "14px 15px", textAlign: "left",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20, transition: "all .15s"
      }}
        onMouseOver={e => { e.currentTarget.style.background = "#fff0f0"; }}
        onMouseOut={e => { e.currentTarget.style.background = "#fff8f8"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: RED, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Upload size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: RED }}>Subir PDF para firmar</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
              Cualquier documento PDF · Sin plantilla necesaria
            </div>
          </div>
        </div>
        <ChevronRight size={15} color={RED} />
      </button>

      {plantillas.length > 0 && (
        <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          O usá una plantilla
        </div>
      )}

      <GrupoPlantillas lista={propias} label="Mis plantillas" />
      <GrupoPlantillas lista={globales} label="Plantillas del sistema" />

      {plantillas.length === 0 && (
        <div style={{ textAlign: "center", padding: "10px 0", color: "#9ca3af", fontSize: 12 }}>
          No hay plantillas configuradas aún.
        </div>
      )}
    </div>
  );
}

// ─── Formulario subir PDF libre ────────────────────────────────────────────────

function FormularioPdf({
  onBack, onSubmit, loading
}: {
  onBack: () => void;
  onSubmit: (payload: { nombre_documento: string; firmantes: Array<{nombre: string; email: string; telefono: string; rol: string}>; pdf_base64: string }) => void;
  loading: boolean;
}) {
  const [nombreDoc, setNombreDoc] = useState("");
  const [firmantes, setFirmantes] = useState([{ nombre: "", email: "", telefono: "", rol: "Firmante" }]);
  const [pdfBase64, setPdfBase64] = useState("");
  const [pdfNombre, setPdfNombre] = useState("");
  const [dragging, setDragging] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8,
    padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", background: "#fff", color: "#111"
  };

  const actualizarFirmante = (i: number, campo: string, valor: string) => {
    setFirmantes(prev => prev.map((f, idx) => idx === i ? { ...f, [campo]: valor } : f));
  };

  const rolesComunes = ["Firmante", "Vendedor", "Comprador", "Locador", "Locatario", "Garante", "Testigo"];

  const procesarPdf = (file: File) => {
    if (file.type !== "application/pdf") { alert("Solo se aceptan archivos PDF"); return; }
    if (file.size > 9 * 1024 * 1024) { alert("El PDF no puede superar 9 MB"); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      setPdfBase64(result);
      setPdfNombre(file.name);
      if (!nombreDoc) setNombreDoc(file.name.replace(/\.pdf$/i, ""));
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) procesarPdf(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) procesarPdf(file);
  };

  const handleSubmit = () => {
    if (!pdfBase64) { alert("Seleccioná un PDF"); return; }
    if (!nombreDoc) { alert("Ingresá un nombre para el documento"); return; }
    for (const f of firmantes) {
      if (!f.nombre || !f.email) { alert("Nombre y email de cada firmante son obligatorios"); return; }
    }
    onSubmit({ nombre_documento: nombreDoc, firmantes, pdf_base64: pdfBase64 });
  };

  return (
    <div>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: RED, fontSize: 12,
        fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16,
        display: "flex", alignItems: "center", gap: 4
      }}>
        ← Volver
      </button>

      <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 4 }}>Subir PDF para firmar</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>El cliente recibe el link por email y firma desde su celular</div>

      {/* Drop zone PDF */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? RED : pdfBase64 ? "#10b981" : "#d1d5db"}`,
          borderRadius: 12, padding: "24px 16px", textAlign: "center",
          background: dragging ? "#fff8f8" : pdfBase64 ? "#f0fdf4" : "#fafafa",
          marginBottom: 18, transition: "all .2s", cursor: "pointer"
        }}
        onClick={() => document.getElementById("pdf-input")?.click()}
      >
        <input id="pdf-input" type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleFileInput} />
        {pdfBase64 ? (
          <div>
            <CheckCircle2 size={28} color="#10b981" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: "#065f46" }}>{pdfNombre}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Clic para cambiar el archivo</div>
          </div>
        ) : (
          <div>
            <Upload size={28} color="#9ca3af" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Arrastrá el PDF acá</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>o hacé clic para buscarlo · Máx 9 MB</div>
          </div>
        )}
      </div>

      {/* Nombre del documento */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Nombre del documento *</label>
        <input value={nombreDoc} onChange={e => setNombreDoc(e.target.value)} style={inputStyle} placeholder="Ej: Contrato de alquiler Pérez" />
      </div>

      {/* Firmantes */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>
          Quiénes tienen que firmar
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {firmantes.map((f, i) => (
            <div key={i} style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                  Firmante {i + 1}
                  {firmantes.length > 1 && <span style={{ color: "#9ca3af", fontWeight: 400, marginLeft: 4 }}>· {f.rol}</span>}
                </div>
                {firmantes.length > 1 && (
                  <button onClick={() => setFirmantes(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 11, fontWeight: 600 }}>
                    ✕ Quitar
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3 }}>Nombre *</label>
                    <input value={f.nombre} onChange={e => actualizarFirmante(i, "nombre", e.target.value)} style={inputStyle} placeholder="Juan García" />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3 }}>Rol</label>
                    <select value={f.rol} onChange={e => actualizarFirmante(i, "rol", e.target.value)} style={inputStyle}>
                      {rolesComunes.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "flex", alignItems: "center", gap: 2, marginBottom: 3 }}>
                      <Mail size={9} /> Email *
                    </label>
                    <input type="email" value={f.email} onChange={e => actualizarFirmante(i, "email", e.target.value)} style={inputStyle} placeholder="juan@gmail.com" />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "flex", alignItems: "center", gap: 2, marginBottom: 3 }}>
                      <Phone size={9} /> Teléfono
                    </label>
                    <input value={f.telefono} onChange={e => actualizarFirmante(i, "telefono", e.target.value)} style={inputStyle} placeholder="+54 11..." />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setFirmantes(prev => [...prev, { nombre: "", email: "", telefono: "", rol: "Firmante" }])} style={{
          width: "100%", background: "none", border: `1.5px dashed ${RED}`, color: RED,
          borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 600,
          cursor: "pointer", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 5
        }}>
          <Plus size={13} /> Agregar otro firmante
        </button>
      </div>

      <button onClick={handleSubmit} disabled={loading || !pdfBase64} style={{
        width: "100%", background: loading || !pdfBase64 ? "#9ca3af" : RED, color: "#fff",
        border: "none", borderRadius: 10, padding: "12px 0", fontSize: 13,
        fontWeight: 700, cursor: loading || !pdfBase64 ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8
      }}>
        <Send size={14} /> {loading ? "Enviando..." : `Enviar a ${firmantes.length} firmante${firmantes.length > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}

// ─── Formulario de datos del documento ────────────────────────────────────────

function FormularioDatos({
  plantilla, onBack, onSubmit, loading
}: {
  plantilla: Plantilla;
  onBack: () => void;
  onSubmit: (datos: Record<string, string>, firmantes: Array<{nombre: string; email: string; telefono: string; rol: string}>) => void;
  loading: boolean;
}) {
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [firmantes, setFirmantes] = useState([{ nombre: "", email: "", telefono: "", rol: "Firmante" }]);

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8,
    padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", background: "#fff", color: "#111"
  };

  const actualizarFirmante = (i: number, campo: string, valor: string) => {
    setFirmantes(prev => prev.map((f, idx) => idx === i ? { ...f, [campo]: valor } : f));
  };

  const agregarFirmante = () => {
    setFirmantes(prev => [...prev, { nombre: "", email: "", telefono: "", rol: "Firmante" }]);
  };

  const quitarFirmante = (i: number) => {
    if (firmantes.length === 1) return;
    setFirmantes(prev => prev.filter((_, idx) => idx !== i));
  };

  const rolesComunes = ["Firmante", "Vendedor", "Comprador", "Locador", "Locatario", "Garante", "Testigo"];

  const handleSubmit = () => {
    for (const c of plantilla.campos) {
      if (c.requerido && !campos[c.nombre]) {
        alert(`El campo "${c.etiqueta}" es obligatorio`);
        return;
      }
    }
    for (const f of firmantes) {
      if (!f.nombre || !f.email) {
        alert("Nombre y email de cada firmante son obligatorios");
        return;
      }
    }
    onSubmit(campos, firmantes);
  };

  return (
    <div>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: RED, fontSize: 12,
        fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16,
        display: "flex", alignItems: "center", gap: 4
      }}>
        ← Volver
      </button>

      <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 2 }}>{plantilla.nombre}</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>{plantilla.descripcion}</div>

      {/* Firmantes */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>
          Quiénes tienen que firmar
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {firmantes.map((f, i) => (
            <div key={i} style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                  Firmante {i + 1}
                  {firmantes.length > 1 && <span style={{ color: "#9ca3af", fontWeight: 400, marginLeft: 4 }}>· {f.rol}</span>}
                </div>
                {firmantes.length > 1 && (
                  <button onClick={() => quitarFirmante(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 11, fontWeight: 600 }}>
                    ✕ Quitar
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3 }}>Nombre *</label>
                    <input value={f.nombre} onChange={e => actualizarFirmante(i, "nombre", e.target.value)} style={inputStyle} placeholder="Juan García" />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3 }}>Rol</label>
                    <select value={f.rol} onChange={e => actualizarFirmante(i, "rol", e.target.value)} style={inputStyle}>
                      {rolesComunes.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "flex", alignItems: "center", gap: 2, marginBottom: 3 }}>
                      <Mail size={9} /> Email *
                    </label>
                    <input type="email" value={f.email} onChange={e => actualizarFirmante(i, "email", e.target.value)} style={inputStyle} placeholder="juan@gmail.com" />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "flex", alignItems: "center", gap: 2, marginBottom: 3 }}>
                      <Phone size={9} /> Teléfono
                    </label>
                    <input value={f.telefono} onChange={e => actualizarFirmante(i, "telefono", e.target.value)} style={inputStyle} placeholder="+54 11..." />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={agregarFirmante} style={{
          width: "100%", background: "none", border: `1.5px dashed ${RED}`, color: RED,
          borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 600,
          cursor: "pointer", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 5
        }}>
          <Plus size={13} /> Agregar otro firmante
        </button>
      </div>

      {/* Campos del documento */}
      {plantilla.campos.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: .5 }}>
            Datos del documento
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {plantilla.campos.map(campo => (
              <div key={campo.nombre}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>
                  {campo.etiqueta}{campo.requerido ? " *" : ""}
                </label>
                {campo.tipo === "textarea" ? (
                  <textarea value={campos[campo.nombre] || ""} onChange={e => setCampos(p => ({ ...p, [campo.nombre]: e.target.value }))}
                    style={{ ...inputStyle, height: 70, resize: "vertical" }} />
                ) : campo.tipo === "select" ? (
                  <select value={campos[campo.nombre] || ""} onChange={e => setCampos(p => ({ ...p, [campo.nombre]: e.target.value }))} style={inputStyle}>
                    <option value="">Seleccioná...</option>
                    {campo.opciones?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={campo.tipo} value={campos[campo.nombre] || ""}
                    onChange={e => setCampos(p => ({ ...p, [campo.nombre]: e.target.value }))} style={inputStyle} />
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <button onClick={handleSubmit} disabled={loading} style={{
        width: "100%", background: loading ? "#9ca3af" : RED, color: "#fff",
        border: "none", borderRadius: 10, padding: "12px 0", fontSize: 13,
        fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", marginTop: 22,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8
      }}>
        <Send size={14} /> {loading ? "Enviando..." : `Enviar a ${firmantes.length} firmante${firmantes.length > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}


// ─── Botón para generar PDF firmado si no existe aún ─────────────────────────

function GenerarPdfBtn({ docId, firmaToken, onListo }: { docId: string; firmaToken: string; onListo: () => void }) {
  const [generando, setGenerando] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const generar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setGenerando(true);
    try {
      const res = await fetch("/api/firma/generar-pdf-final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firma_token: firmaToken }),
      });
      const json = await res.json();
      if (json.pdf_url) {
        setUrl(json.pdf_url);
        onListo();
      } else {
        alert(json.error || "Error al generar PDF");
      }
    } catch { alert("Error de conexión"); }
    setGenerando(false);
  };

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "#065f46", color: "#fff", borderRadius: 8,
          padding: "7px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none"
        }}>
        <Download size={13} /> Descargar PDF firmado
      </a>
    );
  }

  return (
    <button onClick={generar} disabled={generando} style={{
      display: "flex", alignItems: "center", gap: 6,
      background: generando ? "#9ca3af" : "#065f46", color: "#fff",
      border: "none", borderRadius: 8, padding: "7px 14px",
      fontSize: 12, fontWeight: 700, cursor: generando ? "not-allowed" : "pointer"
    }}>
      <Download size={13} /> {generando ? "Generando PDF..." : "Generar PDF firmado"}
    </button>
  );
}

// ─── Fila de documento ─────────────────────────────────────────────────────────

function FilaDocumento({ doc, onVer }: { doc: Documento; onVer: () => void }) {
  const alertar = esPendienteMasDe48h(doc);
  const firmantes = doc.firma_firmantes || [];
  const firmados = firmantes.filter(f => f.estado === "firmado").length;
  const total = firmantes.length;
  const estadoVisual = calcularEstadoVisual(doc);
  const completado = doc.estado === "firmado" || (total > 0 && firmados === total);
  const parcial = total > 0 && firmados > 0 && firmados < total;
  const progreso = total > 0 ? Math.round((firmados / total) * 100) : (completado ? 100 : 0);

  return (
    <div style={{
      background: "#fff", border: `1.5px solid ${alertar ? "#fca5a5" : estadoVisual.border}`,
      borderRadius: 12, overflow: "hidden", transition: "all .15s"
    }}>
      <div onClick={onVer} style={{
        padding: "14px 16px", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12
      }}
        onMouseOver={e => { e.currentTarget.style.background = "#fafafa"; }}
        onMouseOut={e => { e.currentTarget.style.background = ""; }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <FileText size={13} color={completado ? "#065f46" : parcial ? "#854d0e" : RED} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {doc.datos_json?.nombre_documento || doc.firma_plantillas?.nombre || "Documento"}
            </span>
            {alertar && <span title="Pendiente más de 48hs" style={{ display: "inline-flex" }}><AlertCircle size={13} color="#ef4444" /></span>}
          </div>

          {/* Firmantes inline */}
          {firmantes.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
              {firmantes.map(f => (
                <span key={f.id} style={{
                  fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 999,
                  background: f.estado === "firmado" ? "#d1fae5" : "#f3f4f6",
                  color: f.estado === "firmado" ? "#065f46" : "#6b7280",
                  display: "inline-flex", alignItems: "center", gap: 3
                }}>
                  {f.estado === "firmado" ? "✅" : "⏳"} {f.nombre.split(" ")[0]}
                  {f.rol !== "Firmante" ? ` (${f.rol})` : ""}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
              {doc.firmante_nombre} · {doc.firmante_email}
            </div>
          )}

          <div style={{ fontSize: 11, color: "#9ca3af" }}>
            {formatFecha(doc.created_at)}
            {completado && doc.signed_at ? ` · ✅ Completado ${formatFecha(doc.signed_at)}` : ` · Vence ${formatFecha(doc.expires_at)}`}
          </div>

          {/* Barra de progreso si hay múltiples firmantes */}
          {total > 1 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ background: "#f3f4f6", borderRadius: 4, height: 4, overflow: "hidden" }}>
                <div style={{ background: completado ? "#10b981" : parcial ? "#eab308" : RED, width: `${progreso}%`, height: "100%", transition: "width .3s" }} />
              </div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>
                {firmados} de {total} firmaron
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          {estadoBadge(doc)}
        </div>
      </div>

      {/* Barra de descarga si está completado */}
      {completado && (
        <div style={{ borderTop: "1px solid #f0fdf4", padding: "10px 16px", background: "#f0fdf4", display: "flex", gap: 10, alignItems: "center" }}>
          {doc.url_documento_firmado ? (
            <a href={doc.url_documento_firmado} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#065f46", color: "#fff", borderRadius: 8,
                padding: "7px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none", flexShrink: 0
              }}>
              <Download size={13} /> Descargar PDF firmado
            </a>
          ) : (
            <GenerarPdfBtn docId={doc.id} firmaToken={doc.firma_token} onListo={onVer} />
          )}
          <span style={{ fontSize: 11, color: "#065f46" }}>
            {doc.signed_at ? `Completado el ${formatFecha(doc.signed_at)}` : "Completado"}
          </span>
        </div>
      )}
    </div>
  );
}


// ─── Modal detalle documento ───────────────────────────────────────────────────

function ModalDetalle({
  doc, onClose, onReenviar, onEditar
}: {
  doc: Documento;
  onClose: () => void;
  onReenviar: () => Promise<void>;
  onEditar: (nombre: string, email: string, tel: string) => Promise<void>;
}) {
  const [modo, setModo] = useState<"ver" | "editar">("ver");
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [fnombre, setFnombre] = useState(doc.firmante_nombre || "");
  const [femail, setFemail] = useState(doc.firmante_email || "");
  const [ftel, setFtel] = useState(doc.firmante_telefono || "");
  const [msgExito, setMsgExito] = useState("");
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  const firmantes = doc.firma_firmantes || [];
  const tieneFirmantesIndividuales = firmantes.length > 0;
  const todosPendientes = firmantes.every(f => f.estado !== "firmado");
  const nombreDoc = doc.datos_json?.nombre_documento || doc.firma_plantillas?.nombre || "Documento";

  const copiarHash = (firmanteId: string, texto: string) => {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiadoId(firmanteId);
      setTimeout(() => setCopiadoId(null), 2000);
    });
  };

  const reenviarFirmante = async (firmanteId: string, firmanteToken: string) => {
    setReenviandoId(firmanteId);
    try {
      const res = await fetch(`/api/firma/reenviar-firmante`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmante_id: firmanteId, documento_id: doc.id }),
      });
      if (res.ok) {
        setMsgExito("✅ Email reenviado");
        setTimeout(() => setMsgExito(""), 3000);
      } else {
        const j = await res.json();
        alert(j.error || "Error al reenviar");
      }
    } catch { alert("Error de conexión"); }
    setReenviandoId(null);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8,
    padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", color: "#111", background: "#fff"
  };

  return (
    <Modal title={nombreDoc} onClose={onClose}>
      {/* Badge de estado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        {estadoBadge(doc)}
        <span style={{ fontSize: 11, color: "#9ca3af" }}>Enviado {formatFecha(doc.created_at)}</span>
      </div>

      {msgExito && (
        <div style={{ background: "#d1fae5", color: "#065f46", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
          {msgExito}
        </div>
      )}

      {/* ── Firmantes individuales ── */}
      {tieneFirmantesIndividuales ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>
            Firmantes
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {firmantes.map(f => {
              const firmado = f.estado === "firmado";
              const hash = f.firma_token; // usamos el token como hash de auditoría
              return (
                <div key={f.id} style={{
                  border: `1.5px solid ${firmado ? "#6ee7b7" : "#e5e7eb"}`,
                  borderRadius: 10, overflow: "hidden",
                  background: firmado ? "#f0fdf4" : "#fff"
                }}>
                  {/* Header firmante */}
                  <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{f.nombre}</span>
                        {f.rol !== "Firmante" && (
                          <span style={{ fontSize: 10, background: "#f3f4f6", color: "#6b7280", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                            {f.rol}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{f.email}</div>
                      {firmado && f.signed_at && (
                        <div style={{ fontSize: 11, color: "#065f46", fontWeight: 600, marginTop: 3 }}>
                          ✅ Firmó el {new Date(f.signed_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                      {!firmado && (
                        <div style={{ fontSize: 11, color: "#9a3412", marginTop: 3 }}>⏳ Pendiente de firma</div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {firmado ? (
                        <span style={{ fontSize: 18 }}>✅</span>
                      ) : (
                        <button
                          onClick={() => reenviarFirmante(f.id, f.firma_token)}
                          disabled={reenviandoId === f.id}
                          style={{
                            background: reenviandoId === f.id ? "#9ca3af" : RED, color: "#fff",
                            border: "none", borderRadius: 7, padding: "5px 10px",
                            fontSize: 11, fontWeight: 700, cursor: reenviandoId === f.id ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", gap: 4
                          }}>
                          <Send size={10} /> {reenviandoId === f.id ? "..." : "Reenviar"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Hash de auditoría */}
                  <div style={{ padding: "8px 14px", borderTop: "1px solid #f3f4f6", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, marginBottom: 2 }}>
                        Hash de firma
                      </div>
                      <div style={{ fontSize: 10, color: "#374151", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {hash}
                      </div>
                    </div>
                    <button
                      onClick={() => copiarHash(f.id, `Firma digital · ${f.nombre} · ${f.email}\nDocumento: ${nombreDoc}\nHash: ${hash}\n${f.signed_at ? "Firmado: " + new Date(f.signed_at).toLocaleString("es-AR") : "Pendiente"}`)}
                      style={{
                        background: copiadoId === f.id ? "#065f46" : "#e5e7eb",
                        color: copiadoId === f.id ? "#fff" : "#374151",
                        border: "none", borderRadius: 6, padding: "5px 10px",
                        fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                        transition: "all .2s"
                      }}>
                      {copiadoId === f.id ? "✓ Copiado" : "📋 Copiar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Firmante único (legacy) */
        <div style={{ display: "grid", marginBottom: 20 }}>
          {[
            ["Firmante", doc.firmante_nombre],
            ["Email", doc.firmante_email],
            ...(doc.firmante_telefono ? [["Teléfono", doc.firmante_telefono]] : []),
            ...(doc.signed_at ? [["Firmado", formatFecha(doc.signed_at)]] : []),
            ["Vence", formatFecha(doc.expires_at)],
          ].filter(([, v]) => v).map(([k, v], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>{k}</span>
              <span style={{ fontSize: 12, color: "#111", fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Datos del formulario */}
      {Object.keys(doc.datos_json || {}).filter(k => k !== "nombre_documento").length > 0 && (
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>
            Datos del documento
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {Object.entries(doc.datos_json).filter(([k]) => k !== "nombre_documento").map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 11, color: "#6b7280", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                <span style={{ fontSize: 11, color: "#111", fontWeight: 500, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: "grid", gap: 10 }}>
        {doc.url_documento_firmado ? (
          <a href={doc.url_documento_firmado} target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: "#065f46", color: "#fff", borderRadius: 10, padding: "13px 0",
            fontSize: 14, fontWeight: 700, textDecoration: "none"
          }}>
            <Download size={15} /> Descargar PDF firmado
          </a>
        ) : doc.estado === "firmado" ? (
          <GenerarPdfBtn docId={doc.id} firmaToken={doc.firma_token} onListo={onClose} />
        ) : null}

        {/* Reenviar general (solo si un único firmante o legacy) */}
        {!tieneFirmantesIndividuales && doc.estado === "pendiente" && (
          <button onClick={async () => { setReenviandoId("all"); await onReenviar(); setReenviandoId(null); setMsgExito("✅ Email reenviado"); setTimeout(() => setMsgExito(""), 3000); }}
            disabled={reenviandoId === "all"}
            style={{
              width: "100%", background: reenviandoId === "all" ? "#9ca3af" : RED, color: "#fff",
              border: "none", borderRadius: 10, padding: "11px 0", fontSize: 13, fontWeight: 700,
              cursor: reenviandoId === "all" ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8
            }}>
            <Send size={14} /> {reenviandoId === "all" ? "Enviando..." : "Reenviar email de firma"}
          </button>
        )}
      </div>
    </Modal>
  );
}


// ─── Tab Plantillas ────────────────────────────────────────────────────────────

function TabPlantillas({ plantillas, onRefresh }: { plantillas: Plantilla[]; onRefresh: () => void }) {
  const [editando, setEditando] = useState<Plantilla | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [docusealId, setDocusealId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const propias = plantillas.filter(p => !p.es_global);
  const globales = plantillas.filter(p => p.es_global);

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8,
    padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", color: "#111", background: "#fff"
  };

  const abrirEditar = (p: Plantilla) => {
    setEditando(p);
    setNombre(p.nombre);
    setDescripcion(p.descripcion);
    setDocusealId(p.docuseal_template_id?.toString() || "");
    setError("");
  };

  const guardar = async () => {
    if (!editando || !nombre) return;
    setGuardando(true);
    setError("");
    const res = await fetch("/api/firma/plantillas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editando.id,
        nombre,
        descripcion,
        docuseal_template_id: docusealId ? parseInt(docusealId) : null,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Error al guardar"); setGuardando(false); return; }
    setEditando(null);
    onRefresh();
    setGuardando(false);
  };

  const eliminar = async (p: Plantilla) => {
    if (!confirm(`¿Eliminar la plantilla "${p.nombre}"?`)) return;
    await fetch("/api/firma/plantillas", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id }),
    });
    onRefresh();
  };

  return (
    <div>
      {/* Info DocuSeal */}
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 12, color: "#1e40af", lineHeight: 1.6 }}>
        <strong>¿Cómo funciona?</strong> Cada plantilla tiene un <strong>ID de DocuSeal</strong> que la conecta con el PDF que subiste en tu servidor. Sin ese ID, el documento se guarda pero no se envía automáticamente por email.{" "}
        <a href={`${process.env.NEXT_PUBLIC_DOCUSEAL_URL || "#"}/templates`} target="_blank" rel="noopener noreferrer"
          style={{ color: "#1d4ed8", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
          Ir a DocuSeal <ExternalLink size={10} />
        </a>
      </div>

      {/* Plantillas propias */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>
        Mis plantillas
      </div>
      {propias.length === 0 ? (
        <div style={{ background: "#f8fafc", border: "1.5px dashed #e5e7eb", borderRadius: 10, padding: 20, textAlign: "center", fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>
          Todavía no tenés plantillas propias.<br />Las del sistema ya están disponibles para usar.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
          {propias.map(p => (
            <div key={p.id} style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{p.nombre}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                  {p.docuseal_template_id
                    ? <span style={{ color: "#065f46" }}>✅ DocuSeal ID: {p.docuseal_template_id}</span>
                    : <span style={{ color: "#92400e" }}>⚠ Sin ID DocuSeal</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => abrirEditar(p)} style={{ background: "#f3f4f6", border: "none", borderRadius: 7, padding: "6px 8px", cursor: "pointer" }}>
                  <Pencil size={13} color="#374151" />
                </button>
                <button onClick={() => eliminar(p)} style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "6px 8px", cursor: "pointer" }}>
                  <Trash2 size={13} color="#991b1b" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plantillas del sistema */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>
        Plantillas del sistema <Globe size={11} style={{ marginLeft: 4 }} />
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {globales.map(p => (
          <div key={p.id} style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{p.nombre}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>
                {p.docuseal_template_id ? `DocuSeal ID: ${p.docuseal_template_id}` : "Sin ID configurado"}
              </div>
            </div>
            <button onClick={() => abrirEditar(p)} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 11, color: "#6b7280" }}>
              Asignar ID
            </button>
          </div>
        ))}
      </div>

      {/* Modal editar */}
      {editando && (
        <Modal title={editando.es_global ? "Configurar plantilla del sistema" : "Editar plantilla"} onClose={() => setEditando(null)}>
          <div style={{ display: "grid", gap: 14 }}>
            {!editando.es_global && (
              <>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Nombre</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Descripción</label>
                  <input value={descripcion} onChange={e => setDescripcion(e.target.value)} style={inputStyle} />
                </div>
              </>
            )}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>
                ID de DocuSeal (template_id)
              </label>
              <input value={docusealId} onChange={e => setDocusealId(e.target.value)}
                style={inputStyle} placeholder="Ej: 1000001" type="number" />
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.5 }}>
                Lo encontrás en la URL de tu template de DocuSeal: /templates/<strong>1000001</strong>/edit
              </div>
            </div>
            {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
            <button onClick={guardar} disabled={guardando} style={{
              width: "100%", background: guardando ? "#9ca3af" : RED, color: "#fff",
              border: "none", borderRadius: 10, padding: "11px 0", fontSize: 13,
              fontWeight: 700, cursor: guardando ? "not-allowed" : "pointer"
            }}>
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function FirmaDigital() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<"documentos" | "plantillas">("documentos");
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [paso, setPaso] = useState<"selector" | "formulario" | "subir-pdf">("selector");
  const [plantillaSel, setPlantillaSel] = useState<Plantilla | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [docSel, setDocSel] = useState<Documento | null>(null);
  const [exito, setExito] = useState("");

  const cargarDatos = useCallback(async () => {
    const [docsRes, plantRes] = await Promise.all([
      fetch("/api/firma/documentos"),
      fetch("/api/firma/plantillas"),
    ]);
    if (docsRes.ok) setDocumentos(await docsRes.json());
    if (plantRes.ok) setPlantillas(await plantRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") cargarDatos();
  }, [status, cargarDatos]);

  const abrirNuevo = () => { setModalNuevo(true); setPaso("selector"); setPlantillaSel(null); };

  const handleEnviarPdf = async (payload: { nombre_documento: string; firmantes: Array<{nombre: string; email: string; telefono: string; rol: string}>; pdf_base64: string }) => {
    setEnviando(true);
    try {
      const res = await fetch("/api/firma/subir-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setModalNuevo(false);
      await cargarDatos();
      const nombres = payload.firmantes.map(f => f.nombre.split(" ")[0]).join(", ");
      setExito(`✅ PDF enviado a: ${nombres}`);
      setTimeout(() => setExito(""), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setEnviando(false);
    }
  };

  const handleEnviar = async (datos: Record<string, string>, firmantes: Array<{nombre: string; email: string; telefono: string; rol: string}>) => {
    if (!plantillaSel) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/firma/documentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantilla_id: plantillaSel.id,
          datos_json: datos,
          firmantes: firmantes.map((f, i) => ({ ...f, orden: i + 1 })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setModalNuevo(false);
      await cargarDatos();
      const nombres = firmantes.map(f => f.nombre.split(" ")[0]).join(", ");
      setExito(`✅ Documento enviado a: ${nombres}`);
      setTimeout(() => setExito(""), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setEnviando(false);
    }
  };

  const handleReenviar = async (doc: Documento): Promise<void> => {
    const res = await fetch(`/api/firma/${doc.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reenviar" }),
    });
    if (!res.ok) {
      const json = await res.json();
      alert(json.error || "Error al reenviar");
    }
  };

  const handleEditar = async (doc: Documento, nombre: string, emailFirmante: string, tel: string): Promise<void> => {
    const res = await fetch(`/api/firma/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firmante_nombre: nombre, firmante_email: emailFirmante, firmante_telefono: tel }),
    });
    if (res.ok) {
      // Actualizar doc en el estado local sin cerrar el modal
      const { doc: updated } = await res.json();
      setDocumentos(prev => prev.map(d => d.id === doc.id ? { ...d, ...updated } : d));
      setDocSel(prev => prev ? { ...prev, firmante_nombre: nombre, firmante_email: emailFirmante, firmante_telefono: tel } : prev);
    } else {
      const json = await res.json();
      alert(json.error || "Error al guardar");
    }
  };

  const pendientesAlerta = documentos.filter(esPendienteMasDe48h).length;
  const firmados = documentos.filter(d => d.estado === "firmado");
  const pendientes = documentos.filter(d => d.estado === "pendiente");

  if (status === "loading" || loading) {
    return (
      <AppLayout>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
          <div style={{ fontSize: 13, color: "#9ca3af" }}>Cargando...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <>
      <Head><title>Firma Digital</title></Head>
      <AppLayout>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px 40px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: RED, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileSignature size={19} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#111", display: "flex", alignItems: "center", gap: 8 }}>
                  Firma Digital
                  {pendientesAlerta > 0 && (
                    <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "2px 7px" }}>
                      {pendientesAlerta}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                  {documentos.length} doc{documentos.length !== 1 ? "s" : ""} · {firmados.length} firmado{firmados.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
            <button onClick={abrirNuevo} style={{
              background: RED, color: "#fff", border: "none", borderRadius: 10,
              padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6
            }}>
              <Plus size={14} /> Nuevo documento
            </button>
          </div>

          {/* Éxito */}
          {exito && (
            <div style={{ background: "#d1fae5", color: "#065f46", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
              {exito}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 20 }}>
            {[
              { id: "documentos", label: "Documentos", Icon: FileText },
              { id: "plantillas", label: "Plantillas", Icon: Settings },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as "documentos" | "plantillas")} style={{
                flex: 1, background: tab === t.id ? "#fff" : "transparent",
                border: "none", borderRadius: 7, padding: "8px 0", fontSize: 12,
                fontWeight: 600, color: tab === t.id ? RED : "#6b7280",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                transition: "all .15s"
              }}>
                <t.Icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          {/* Tab: Documentos */}
          {tab === "documentos" && (
            <>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[
                  { label: "Pendientes", value: pendientes.length, color: "#92400e", bg: "#fef3c7" },
                  { label: "Firmados", value: firmados.length, color: "#065f46", bg: "#d1fae5" },
                  { label: "Total", value: documentos.length, color: "#374151", bg: "#f3f4f6" },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Lista */}
              {documentos.length === 0 ? (
                <div style={{ background: "#f8fafc", border: "1.5px dashed #e5e7eb", borderRadius: 14, padding: 36, textAlign: "center" }}>
                  <FileSignature size={32} color="#d1d5db" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Todavía no enviaste ningún documento
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>
                    Elegí una plantilla y enviala al cliente para que firme desde su celular
                  </div>
                  <button onClick={abrirNuevo} style={{
                    background: RED, color: "#fff", border: "none", borderRadius: 10,
                    padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer"
                  }}>
                    Crear primer documento
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {documentos.map(doc => (
                    <FilaDocumento key={doc.id} doc={doc} onVer={() => setDocSel(doc)} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Tab: Plantillas */}
          {tab === "plantillas" && (
            <TabPlantillas plantillas={plantillas} onRefresh={cargarDatos} />
          )}
        </div>

        {/* Modal Nuevo Documento */}
        {modalNuevo && (
          <Modal title="Nuevo documento" onClose={() => setModalNuevo(false)}>
            {paso === "selector" ? (
              <SelectorPlantilla
                plantillas={plantillas}
                onSelect={p => { setPlantillaSel(p); setPaso("formulario"); }}
                onSubirPdf={() => setPaso("subir-pdf")}
              />
            ) : paso === "subir-pdf" ? (
              <FormularioPdf
                onBack={() => setPaso("selector")}
                onSubmit={handleEnviarPdf}
                loading={enviando}
              />
            ) : plantillaSel ? (
              <FormularioDatos
                plantilla={plantillaSel}
                onBack={() => setPaso("selector")}
                onSubmit={handleEnviar}
                loading={enviando}
              />
            ) : null}
          </Modal>
        )}

        {/* Modal Detalle Documento */}
        {docSel && (
          <ModalDetalle
            doc={docSel}
            onClose={() => setDocSel(null)}
            onReenviar={() => handleReenviar(docSel)}
            onEditar={(nombre, emailF, tel) => handleEditar(docSel, nombre, emailF, tel)}
          />
        )}
      </AppLayout>
    </>
  );
}


