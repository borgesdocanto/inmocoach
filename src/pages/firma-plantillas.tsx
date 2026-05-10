// pages/firma-plantillas.tsx — ABM completo de plantillas de firma (owner + team_leader)

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import AppLayout from "../components/AppLayout";
import {
  FileText, Plus, Pencil, Trash2, Upload, X, Save,
  Globe, Building2, ChevronDown, ChevronUp, GripVertical, AlertCircle, Eye
} from "lucide-react";

const RED = "#aa0000";

interface Campo {
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
  campos: Campo[];
  docuseal_template_id: number | null;
  es_global: boolean;
  team_id: string | null;
  activo: boolean;
  pdf_url: string | null;
  created_by: string | null;
  created_at: string;
}

const TIPOS_CAMPO: { value: Campo["tipo"]; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Fecha" },
  { value: "textarea", label: "Texto largo" },
  { value: "select", label: "Lista de opciones" },
];

// ─── Editor de campos ──────────────────────────────────────────────────────────

function EditorCampos({ campos, onChange }: { campos: Campo[]; onChange: (c: Campo[]) => void }) {
  const [expandido, setExpandido] = useState<number | null>(null);

  const agregar = () => {
    const nuevo: Campo = { nombre: `campo_${Date.now()}`, etiqueta: "Nuevo campo", tipo: "text", requerido: true };
    onChange([...campos, nuevo]);
    setExpandido(campos.length);
  };

  const actualizar = (i: number, parcial: Partial<Campo>) => {
    const nuevos = campos.map((c, idx) => idx === i ? { ...c, ...parcial } : c);
    onChange(nuevos);
  };

  const eliminar = (i: number) => {
    onChange(campos.filter((_, idx) => idx !== i));
    setExpandido(null);
  };

  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= campos.length) return;
    const nuevos = [...campos];
    [nuevos[i], nuevos[j]] = [nuevos[j], nuevos[i]];
    onChange(nuevos);
    setExpandido(j);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8,
    padding: "7px 11px", fontSize: 13, outline: "none",
    boxSizing: "border-box", fontFamily: "inherit", color: "#111", background: "#fff"
  };

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>
        Campos del formulario
      </div>

      {campos.length === 0 && (
        <div style={{ background: "#f8fafc", border: "1.5px dashed #e5e7eb", borderRadius: 10, padding: 16, textAlign: "center", fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>
          Sin campos. Agregá los datos que el inmobiliario tiene que completar al usar esta plantilla.
        </div>
      )}

      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        {campos.map((campo, i) => (
          <div key={i} style={{ background: "#fff", border: `1.5px solid ${expandido === i ? RED : "#e5e7eb"}`, borderRadius: 10, overflow: "hidden", transition: "border-color .15s" }}>
            {/* Header del campo */}
            <div
              onClick={() => setExpandido(expandido === i ? null : i)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer", background: expandido === i ? "#fff8f8" : "#fff" }}
            >
              <GripVertical size={14} color="#d1d5db" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {campo.etiqueta || campo.nombre}
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>
                  {TIPOS_CAMPO.find(t => t.value === campo.tipo)?.label}
                  {campo.requerido ? " · Requerido" : " · Opcional"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={e => { e.stopPropagation(); mover(i, -1); }} disabled={i === 0}
                  style={{ background: "none", border: "none", cursor: i === 0 ? "not-allowed" : "pointer", opacity: i === 0 ? .3 : 1, padding: 2 }}>
                  <ChevronUp size={14} color="#6b7280" />
                </button>
                <button onClick={e => { e.stopPropagation(); mover(i, 1); }} disabled={i === campos.length - 1}
                  style={{ background: "none", border: "none", cursor: i === campos.length - 1 ? "not-allowed" : "pointer", opacity: i === campos.length - 1 ? .3 : 1, padding: 2 }}>
                  <ChevronDown size={14} color="#6b7280" />
                </button>
                <button onClick={e => { e.stopPropagation(); eliminar(i); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                  <Trash2 size={14} color="#ef4444" />
                </button>
              </div>
            </div>

            {/* Formulario expandido */}
            {expandido === i && (
              <div style={{ padding: "14px 12px", borderTop: "1px solid #f3f4f6", display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3, textTransform: "uppercase" }}>Etiqueta visible</label>
                    <input value={campo.etiqueta} onChange={e => actualizar(i, { etiqueta: e.target.value })} style={inputStyle} placeholder="Ej: Nombre del vendedor" />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3, textTransform: "uppercase" }}>Nombre interno</label>
                    <input
                      value={campo.nombre}
                      onChange={e => actualizar(i, { nombre: e.target.value.replace(/\s/g, "_").toLowerCase() })}
                      style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12 }}
                      placeholder="vendedor_nombre"
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3, textTransform: "uppercase" }}>Tipo de campo</label>
                    <select value={campo.tipo} onChange={e => actualizar(i, { tipo: e.target.value as Campo["tipo"], opciones: e.target.value === "select" ? ["Opción 1", "Opción 2"] : undefined })} style={inputStyle}>
                      {TIPOS_CAMPO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 18 }}>
                    <input type="checkbox" id={`req-${i}`} checked={campo.requerido} onChange={e => actualizar(i, { requerido: e.target.checked })} style={{ width: 16, height: 16 }} />
                    <label htmlFor={`req-${i}`} style={{ fontSize: 13, color: "#374151", cursor: "pointer" }}>Requerido</label>
                  </div>
                </div>
                {campo.tipo === "select" && (
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3, textTransform: "uppercase" }}>Opciones (una por línea)</label>
                    <textarea
                      value={(campo.opciones || []).join("\n")}
                      onChange={e => actualizar(i, { opciones: e.target.value.split("\n").filter(Boolean) })}
                      style={{ ...inputStyle, height: 80, resize: "vertical" }}
                      placeholder={"USD\nARS\nOtro"}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={agregar} style={{
        width: "100%", background: "none", border: `1.5px dashed ${RED}`, color: RED,
        borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6
      }}>
        <Plus size={14} /> Agregar campo
      </button>
    </div>
  );
}

// ─── Modal editar / crear plantilla ───────────────────────────────────────────

function ModalPlantilla({
  plantilla, onClose, onGuardar
}: {
  plantilla: Plantilla | null; // null = crear nueva
  onClose: () => void;
  onGuardar: () => void;
}) {
  const [nombre, setNombre] = useState(plantilla?.nombre || "");
  const [descripcion, setDescripcion] = useState(plantilla?.descripcion || "");
  const [campos, setCampos] = useState<Campo[]>(plantilla?.campos || []);
  const [docusealId, setDocusealId] = useState(plantilla?.docuseal_template_id?.toString() || "");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfNombre, setPdfNombre] = useState(plantilla?.pdf_url ? "PDF cargado ✓" : "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"info" | "campos" | "avanzado">("info");
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert("El PDF no puede superar 20 MB"); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      setPdfBase64(ev.target?.result as string);
      setPdfNombre(file.name);
      if (!nombre) setNombre(file.name.replace(/\.pdf$/i, ""));
    };
    reader.readAsDataURL(file);
  };

  const guardar = async () => {
    if (!nombre.trim()) { setError("El nombre es obligatorio"); return; }
    setGuardando(true); setError("");

    const body: Record<string, unknown> = { nombre, descripcion, campos };
    if (docusealId) body.docuseal_template_id = parseInt(docusealId);
    if (pdfBase64) body.pdf_base64 = pdfBase64;

    const isEdit = !!plantilla;
    if (isEdit) body.id = plantilla!.id;

    const res = await fetch("/api/firma/plantillas", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Error al guardar"); setGuardando(false); return; }
    onGuardar();
    onClose();
    setGuardando(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8,
    padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", color: "#111", background: "#fff"
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 600,
        maxHeight: "92vh", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,.25)"
      }}>
        {/* Header */}
        <div style={{ padding: "18px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>
            {plantilla ? "Editar plantilla" : "Nueva plantilla"}
          </div>
          <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} color="#6b7280" />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, padding: "14px 24px 0", borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
          {[
            { id: "info", label: "📋 Datos" },
            { id: "campos", label: `📝 Campos (${campos.length})` },
            { id: "avanzado", label: "⚙ Avanzado" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)} style={{
              background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? RED : "transparent"}`,
              color: tab === t.id ? RED : "#6b7280", fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              padding: "8px 16px", cursor: "pointer", marginBottom: -1, transition: "all .15s"
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido scrolleable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {tab === "info" && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5, display: "block", marginBottom: 5 }}>
                  Nombre de la plantilla *
                </label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} placeholder="Ej: Boleto de Reserva" autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5, display: "block", marginBottom: 5 }}>
                  Descripción
                </label>
                <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
                  style={{ ...inputStyle, height: 70, resize: "vertical" }}
                  placeholder="Descripción breve de cuándo se usa esta plantilla" />
              </div>

              {/* PDF Upload */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5, display: "block", marginBottom: 8 }}>
                  Documento PDF base
                </label>
                <input ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handlePdf} />
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${pdfBase64 || plantilla?.pdf_url ? "#10b981" : "#d1d5db"}`,
                    borderRadius: 12, padding: 20, textAlign: "center", cursor: "pointer",
                    background: pdfBase64 || plantilla?.pdf_url ? "#f0fdf4" : "#fafafa", transition: "all .2s"
                  }}
                >
                  {pdfBase64 || plantilla?.pdf_url ? (
                    <div>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>✅</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#065f46" }}>{pdfNombre || "PDF cargado"}</div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Clic para reemplazar</div>
                    </div>
                  ) : (
                    <div>
                      <Upload size={24} color="#9ca3af" style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Subir PDF de la plantilla</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Este documento se enviará a los clientes · Máx 20 MB</div>
                    </div>
                  )}
                </div>
                {plantilla?.pdf_url && !pdfBase64 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <a href={plantilla.pdf_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: RED, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                      <Eye size={12} /> Ver PDF actual
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "campos" && (
            <EditorCampos campos={campos} onChange={setCampos} />
          )}

          {tab === "avanzado" && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5, display: "block", marginBottom: 5 }}>
                  ID de DocuSeal (opcional)
                </label>
                <input value={docusealId} onChange={e => setDocusealId(e.target.value)}
                  style={inputStyle} type="number" placeholder="Ej: 1000001" />
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5, lineHeight: 1.5 }}>
                  Si tenés DocuSeal instalado, ingresá el ID del template.<br/>
                  Lo encontrás en la URL: <code>/templates/<strong>1000001</strong>/edit</code>
                </div>
              </div>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 14, fontSize: 12, color: "#1e40af", lineHeight: 1.7 }}>
                <strong>DocuSeal es open source y gratuito.</strong><br />
                Instalalo en tu servidor con Docker:<br />
                <code style={{ background: "#dbeafe", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>
                  docker run -p 3000:3000 docuseal/docuseal
                </code><br />
                Luego configurá <code>DOCUSEAL_URL</code> y <code>DOCUSEAL_API_KEY</code> en Vercel.
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{
            flex: 1, background: "#f3f4f6", border: "none", borderRadius: 10,
            padding: "11px 0", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer"
          }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando} style={{
            flex: 2, background: guardando ? "#9ca3af" : RED, color: "#fff",
            border: "none", borderRadius: 10, padding: "11px 0",
            fontSize: 13, fontWeight: 700, cursor: guardando ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8
          }}>
            <Save size={14} /> {guardando ? "Guardando..." : plantilla ? "Guardar cambios" : "Crear plantilla"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function FirmaPlantillas() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [modalPlantilla, setModalPlantilla] = useState<Plantilla | null | "nueva">(undefined as unknown as null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [plantRes, subRes] = await Promise.all([
      fetch("/api/firma/plantillas"),
      fetch("/api/subscription"),
    ]);
    if (plantRes.ok) setPlantillas(await plantRes.json());
    if (subRes.ok) {
      const sub = await subRes.json();
      const role = sub.subscription?.teamRole;
      const isAdmin = sub.subscription?.email === "leandro@galas.com.ar";
      setCanManage(role === "owner" || role === "team_leader" || isAdmin);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (status === "authenticated") cargar(); }, [status, cargar]);

  const abrirNueva = () => { setModalPlantilla("nueva"); setModalAbierto(true); };
  const abrirEditar = (p: Plantilla) => { setModalPlantilla(p); setModalAbierto(true); };
  const cerrarModal = () => { setModalAbierto(false); setTimeout(() => setModalPlantilla(null as unknown as null), 200); };

  const eliminar = async (p: Plantilla) => {
    if (!confirm(`¿Eliminar la plantilla "${p.nombre}"? Los documentos existentes no se verán afectados.`)) return;
    setEliminando(p.id);
    await fetch("/api/firma/plantillas", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id }),
    });
    await cargar();
    setEliminando(null);
  };

  const propias = plantillas.filter(p => !p.es_global);
  const globales = plantillas.filter(p => p.es_global);

  const GrupoPlantillas = ({ lista, titulo, badge }: { lista: Plantilla[]; titulo: string; badge?: React.ReactNode }) => (
    lista.length > 0 ? (
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5 }}>{titulo}</div>
          {badge}
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {lista.map(p => (
            <div key={p.id} style={{
              background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12,
              padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <FileText size={14} color={RED} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{p.nombre}</span>
                  {p.es_global
                    ? <span title="Plantilla del sistema"><Globe size={11} color="#9ca3af" /></span>
                    : <span title="Plantilla de tu inmobiliaria"><Building2 size={11} color="#0ea5e9" /></span>}
                </div>
                {p.descripcion && <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{p.descripcion}</div>}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>
                    {p.campos?.length || 0} campo{p.campos?.length !== 1 ? "s" : ""}
                  </span>
                  {p.pdf_url && (
                    <a href={p.pdf_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 10, color: RED, textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                      <Eye size={10} /> Ver PDF
                    </a>
                  )}
                  {p.docuseal_template_id && (
                    <span style={{ fontSize: 10, color: "#065f46", background: "#d1fae5", padding: "1px 6px", borderRadius: 4 }}>
                      DocuSeal #{p.docuseal_template_id}
                    </span>
                  )}
                </div>
              </div>
              {canManage && !p.es_global && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => abrirEditar(p)} style={{
                    background: "#f3f4f6", border: "none", borderRadius: 8,
                    padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                    fontSize: 12, fontWeight: 600, color: "#374151"
                  }}>
                    <Pencil size={13} /> Editar
                  </button>
                  <button onClick={() => eliminar(p)} disabled={eliminando === p.id} style={{
                    background: "#fee2e2", border: "none", borderRadius: 8,
                    padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center",
                    opacity: eliminando === p.id ? .5 : 1
                  }}>
                    <Trash2 size={13} color="#991b1b" />
                  </button>
                </div>
              )}
              {canManage && p.es_global && (
                <button onClick={() => abrirEditar(p)} style={{
                  background: "none", border: "1px solid #e5e7eb", borderRadius: 8,
                  padding: "6px 12px", cursor: "pointer", fontSize: 11, color: "#6b7280"
                }}>
                  Asignar ID DocuSeal
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    ) : null
  );

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
      <Head><title>Plantillas de Firma</title></Head>
      <AppLayout>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px 40px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: RED, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={19} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#111" }}>Plantillas de Firma</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                  {plantillas.length} plantilla{plantillas.length !== 1 ? "s" : ""} · {propias.length} propia{propias.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
            {canManage && (
              <button onClick={abrirNueva} style={{
                background: RED, color: "#fff", border: "none", borderRadius: 10,
                padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6
              }}>
                <Plus size={14} /> Nueva plantilla
              </button>
            )}
          </div>

          {!canManage && (
            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#92400e", marginBottom: 20, display: "flex", gap: 8 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              Solo los owners y team leaders pueden crear y editar plantillas.
            </div>
          )}

          <GrupoPlantillas
            lista={propias}
            titulo="Plantillas de mi inmobiliaria"
            badge={<Building2 size={13} color="#0ea5e9" />}
          />

          <GrupoPlantillas
            lista={globales}
            titulo="Plantillas del sistema"
            badge={<Globe size={13} color="#9ca3af" />}
          />

          {plantillas.length === 0 && (
            <div style={{ background: "#f8fafc", border: "1.5px dashed #e5e7eb", borderRadius: 14, padding: 40, textAlign: "center" }}>
              <FileText size={32} color="#d1d5db" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Sin plantillas</div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>
                Creá tus propias plantillas con los documentos que más usás
              </div>
              {canManage && (
                <button onClick={abrirNueva} style={{
                  background: RED, color: "#fff", border: "none", borderRadius: 10,
                  padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer"
                }}>
                  Crear primera plantilla
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal crear/editar */}
        {modalAbierto && (
          <ModalPlantilla
            plantilla={modalPlantilla === "nueva" ? null : modalPlantilla as Plantilla}
            onClose={cerrarModal}
            onGuardar={cargar}
          />
        )}
      </AppLayout>
    </>
  );
}
