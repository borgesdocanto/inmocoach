// pages/firmar/[token].tsx — Portal público de firma para el cliente (sin login)
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const RED = "#aa0000";

interface DocInfo {
  id: string;
  estado: string;
  firmante_nombre: string;
  firmante_email: string;
  nombre_documento: string;
  agency_name: string;
  expires_at: string;
  signed_at: string | null;
  tiene_dni: boolean;
  tiene_selfie: boolean;
  tiene_firma: boolean;
  datos_formulario?: Record<string, string>;
}

// ─── Paso 1: Ver documento + info antes de firmar ─────────────────────────────

function BienvenidaConPdf({
  doc, token, agencyName, onContinuar
}: {
  doc: DocInfo;
  token: string;
  agencyName: string;
  onContinuar: () => void;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [cargandoPdf, setCargandoPdf] = useState(true);
  const [leido, setLeido] = useState(false);

  useEffect(() => {
    fetch(`/api/firmar/${token}/pdf`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.pdf_url) setPdfUrl(d.pdf_url); })
      .finally(() => setCargandoPdf(false));
  }, [token]);

  return (
    <div>
      {/* Header */}
      <div style={{ background: RED, borderRadius: "12px 12px 0 0", padding: "18px 20px" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,.7)", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>
          {agencyName} · Firma Digital
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>{doc.nombre_documento}</div>
      </div>

      {/* Info del destinatario */}
      <div style={{ background: "#f8fafc", padding: "12px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", gap: 16, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5 }}>Destinatario</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{doc.firmante_nombre}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>{doc.firmante_email}</div>
        </div>
      </div>

      {/* Visor del PDF */}
      <div style={{ background: "#fff", padding: 0 }}>
        {cargandoPdf ? (
          <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Cargando documento...</div>
            </div>
          </div>
        ) : pdfUrl ? (
          <div>
            <div style={{ background: "#1e293b", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>📄 {doc.nombre_documento}</span>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: "#60a5fa", textDecoration: "none" }}>
                Abrir en nueva pestaña ↗
              </a>
            </div>
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              style={{ width: "100%", height: 480, border: "none", display: "block" }}
              title="Documento para firmar"
              onLoad={() => {
                // Marcar como leído después de 3 segundos de ver el PDF
                setTimeout(() => setLeido(true), 3000);
              }}
            />
          </div>
        ) : (
          // Sin PDF subido — mostrar los datos del formulario
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: .5 }}>
              Datos del documento
            </div>
            {doc.datos_formulario && Object.keys(doc.datos_formulario).length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                {Object.entries(doc.datos_formulario).filter(([k]) => k !== "nombre_documento").map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                    <span style={{ fontSize: 12, color: "#6b7280", textTransform: "capitalize", minWidth: 130 }}>
                      {k.replace(/_/g, " ")}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: 14, fontSize: 13, color: "#92400e" }}>
                ⚠ El inmobiliario no adjuntó el PDF del documento. Contactalo para verificar el contenido antes de firmar.
              </div>
            )}
            {/* Auto-habilitar el botón si no hay PDF */}
            {!leido && setTimeout(() => setLeido(true), 100) as unknown as null}
          </div>
        )}
      </div>

      {/* Checklist + botón continuar */}
      <div style={{ padding: 20, background: "#fff", borderTop: "1px solid #e5e7eb", borderRadius: "0 0 12px 12px" }}>
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
            Para firmar vas a necesitar:
          </div>
          {[
            { icono: "🪪", texto: "Foto del frente y dorso de tu DNI" },
            { icono: "🤳", texto: "Selfie sosteniendo el DNI" },
            { icono: "✍️", texto: "Tu firma con el dedo o el mouse" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>{item.icono}</span>
              <span style={{ fontSize: 13, color: "#374151" }}>{item.texto}</span>
            </div>
          ))}
        </div>

        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 10, marginBottom: 16, fontSize: 11, color: "#1e40af" }}>
          🔒 Tus datos se usan únicamente para validar tu identidad en este documento.
        </div>

        {/* Disclaimer legal para el firmante */}
        <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
          <strong style={{ display: "block", marginBottom: 6 }}>⚖️ Al continuar confirmás que:</strong>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#6b7280" }}>
            <li>Leíste y comprendés el contenido del documento</li>
            <li>Tu firma electrónica tiene validez legal (Ley 25.506 - Argentina)</li>
            <li>Las fotos de tu DNI y selfie quedan registradas como prueba de identidad</li>
            <li>No podés desconocer la firma una vez completado el proceso</li>
          </ul>
        </div>

        {pdfUrl && !leido && (
          <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 12, color: "#92400e", textAlign: "center" }}>
            Revisá el documento antes de continuar...
          </div>
        )}

        <button
          onClick={onContinuar}
          disabled={pdfUrl ? !leido : false}
          style={{
            width: "100%", background: (pdfUrl && !leido) ? "#9ca3af" : RED,
            color: "#fff", border: "none", borderRadius: 12,
            padding: "14px 0", fontSize: 15, fontWeight: 700,
            cursor: (pdfUrl && !leido) ? "not-allowed" : "pointer",
            transition: "background .3s"
          }}>
          {(pdfUrl && !leido) ? "Revisá el documento primero..." : "He leído y acepto → Firmar"}
        </button>
      </div>
    </div>
  );
}

// ─── Canvas de firma ───────────────────────────────────────────────────────────

function CanvasFirma({ onFirma }: { onFirma: (base64: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [tieneTrazos, setTieneTrazos] = useState(false);

  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    };
  };

  const iniciar = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    dibujando.current = true;
  };

  const dibujar = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!dibujando.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setTieneTrazos(true);
  };

  const terminar = () => { dibujando.current = false; };

  const limpiar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTieneTrazos(false);
  };

  const confirmar = () => {
    const canvas = canvasRef.current;
    if (!canvas || !tieneTrazos) return;
    onFirma(canvas.toDataURL("image/png"));
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
        Firmá con el dedo o el mouse en el recuadro:
      </div>
      <div style={{ border: "2px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff", touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          style={{ width: "100%", height: 180, cursor: "crosshair", display: "block" }}
          onMouseDown={iniciar}
          onMouseMove={dibujar}
          onMouseUp={terminar}
          onMouseLeave={terminar}
          onTouchStart={iniciar}
          onTouchMove={dibujar}
          onTouchEnd={terminar}
        />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button onClick={limpiar} style={{
          flex: 1, background: "#f3f4f6", border: "none", borderRadius: 10,
          padding: "11px 0", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer"
        }}>
          🗑 Borrar
        </button>
        <button onClick={confirmar} disabled={!tieneTrazos} style={{
          flex: 2, background: tieneTrazos ? RED : "#9ca3af", color: "#fff",
          border: "none", borderRadius: 10, padding: "11px 0",
          fontSize: 13, fontWeight: 700, cursor: tieneTrazos ? "pointer" : "not-allowed"
        }}>
          ✅ Confirmar firma
        </button>
      </div>
    </div>
  );
}

// ─── Captura de cámara / archivo ───────────────────────────────────────────────

function CapturaImagen({
  label, descripcion, icono, onCaptura, capturado
}: {
  label: string;
  descripcion: string;
  icono: string;
  onCaptura: (base64: string, mime: string) => void;
  capturado: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      onCaptura(result, file.type);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px ${capturado ? "solid" : "dashed"} ${capturado ? "#10b981" : "#d1d5db"}`,
        borderRadius: 12, padding: "20px 16px", textAlign: "center",
        cursor: "pointer", background: capturado ? "#f0fdf4" : "#fafafa",
        transition: "all .2s"
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFile}
      />
      <div style={{ fontSize: 28, marginBottom: 8 }}>{capturado ? "✅" : icono}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: capturado ? "#065f46" : "#374151" }}>
        {capturado ? `${label} ✓` : label}
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{descripcion}</div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function PortalFirma() {
  const router = useRouter();
  const { token } = router.query as { token: string };

  const [doc, setDoc] = useState<DocInfo | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [paso, setPaso] = useState<"bienvenida" | "documentos_id" | "selfie" | "firma" | "completado">("bienvenida");
  const [subiendo, setSubiendo] = useState(false);
  const [firmando, setFirmando] = useState(false);

  // Estado de capturas
  const [dniFrenteOk, setDniFrenteOk] = useState(false);
  const [dniDorsoOk, setDniDorsoOk] = useState(false);
  const [selfieOk, setSelfieOk] = useState(false);
  const [firmaOk, setFirmaOk] = useState(false);

  const cargarDoc = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/firmar/${token}`);
      if (!res.ok) {
        const j = await res.json();
        setError(j.error || "Documento no encontrado");
        setCargando(false);
        return;
      }
      const data = await res.json();
      setDoc(data);
      // Restaurar progreso
      if (data.tiene_firma && data.tiene_selfie && data.tiene_dni) {
        if (data.estado === "firmado") setPaso("completado");
        else setPaso("firma");
      } else if (data.tiene_selfie) {
        setSelfieOk(true);
        setPaso("firma");
      } else if (data.tiene_dni) {
        setDniFrenteOk(true); setDniDorsoOk(true);
        setPaso("selfie");
      }
    } catch {
      setError("Error de conexión");
    }
    setCargando(false);
  }, [token]);

  useEffect(() => { cargarDoc(); }, [cargarDoc]);

  const subirImagen = async (tipo: string, base64: string, mime: string) => {
    setSubiendo(true);
    try {
      const res = await fetch(`/api/firmar/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subir_imagen", tipo, base64, mime }),
      });
      if (!res.ok) { const j = await res.json(); alert(j.error || "Error al subir"); }
    } catch { alert("Error de conexión"); }
    setSubiendo(false);
  };

  const completarFirma = async () => {
    setFirmando(true);
    try {
      // Usar el endpoint unificado que maneja tanto firmante-token como doc-token
      const res = await fetch(`/api/firmar/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "firmar" }),
      });
      if (res.ok) {
        // Generar PDF en background
        fetch("/api/firma/generar-pdf-final", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firma_token: token }),
        }).catch(() => {});

        setPaso("completado");
        setDoc(prev => prev ? { ...prev, estado: "firmado" } : prev);
      } else {
        const j = await res.json();
        alert(j.error || "Error al firmar");
      }
    } catch { alert("Error de conexión"); }
    setFirmando(false);
  };

  // ── Estilos base ──
  const cardStyle: React.CSSProperties = {
    background: "#fff", borderRadius: 16,
    boxShadow: "0 4px 24px rgba(0,0,0,.08)", overflow: "hidden"
  };

  if (cargando) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
        <div style={{ fontSize: 14, color: "#6b7280" }}>Cargando documento...</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 24 }}>
      <div style={{ ...cardStyle, maxWidth: 400, width: "100%", padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111", marginBottom: 8 }}>Link inválido</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>{error}</div>
      </div>
    </div>
  );

  if (!doc) return null;

  const agencyName = doc.agency_name;

  return (
    <>
      <Head>
        <title>{doc.nombre_documento} · {doc.agency_name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" }}>

        {/* Header */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 20px" }}>
          <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: RED, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
              ✍
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{agencyName}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Documentos · Firma electrónica</div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 520, margin: "0 auto", padding: "20px 16px 40px" }}>

          {/* Progreso */}
          {paso !== "completado" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
              {[
                { id: "bienvenida", label: "Documento" },
                { id: "documentos_id", label: "DNI" },
                { id: "selfie", label: "Selfie" },
                { id: "firma", label: "Firma" },
              ].map((p, i) => {
                const pasos = ["bienvenida", "documentos_id", "selfie", "firma"];
                const actual = pasos.indexOf(paso);
                const este = pasos.indexOf(p.id);
                const completado = este < actual;
                const activo = este === actual;
                return (
                  <div key={p.id} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{
                      height: 4, borderRadius: 4,
                      background: completado ? "#10b981" : activo ? RED : "#e5e7eb",
                      marginBottom: 4, transition: "background .3s"
                    }} />
                    <div style={{
                      fontSize: 10, fontWeight: 600,
                      color: completado ? "#065f46" : activo ? RED : "#9ca3af"
                    }}>
                      {completado ? "✓ " : `${i + 1}. `}{p.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Paso 1: Ver documento ── */}
          {paso === "bienvenida" && (
            <BienvenidaConPdf
              doc={doc}
              token={token}
              agencyName={agencyName}
              onContinuar={() => setPaso("documentos_id")}
            />
          )}

          {/* ── Paso 2: Foto DNI ── */}
          {paso === "documentos_id" && (
            <div style={cardStyle}>
              <div style={{ padding: 24 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 4 }}>🪪 Foto del DNI</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
                  Sacá una foto clara del frente y dorso de tu DNI
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <CapturaImagen
                    label="Frente"
                    descripcion="Lado con tu foto"
                    icono="🪪"
                    capturado={dniFrenteOk}
                    onCaptura={async (b64, mime) => {
                      await subirImagen("dni_frente", b64, mime);
                      setDniFrenteOk(true);
                    }}
                  />
                  <CapturaImagen
                    label="Dorso"
                    descripcion="Lado con el código"
                    icono="📋"
                    capturado={dniDorsoOk}
                    onCaptura={async (b64, mime) => {
                      await subirImagen("dni_dorso", b64, mime);
                      setDniDorsoOk(true);
                    }}
                  />
                </div>
                {subiendo && (
                  <div style={{ textAlign: "center", fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                    Subiendo imagen...
                  </div>
                )}
                <button
                  onClick={() => setPaso("selfie")}
                  disabled={!dniFrenteOk || !dniDorsoOk}
                  style={{
                    width: "100%", background: dniFrenteOk && dniDorsoOk ? RED : "#9ca3af",
                    color: "#fff", border: "none", borderRadius: 12, padding: "14px 0",
                    fontSize: 15, fontWeight: 700, cursor: dniFrenteOk && dniDorsoOk ? "pointer" : "not-allowed"
                  }}>
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* ── Paso 3: Selfie ── */}
          {paso === "selfie" && (
            <div style={cardStyle}>
              <div style={{ padding: 24 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 4 }}>🤳 Selfie con DNI</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
                  Sacate una foto sosteniendo tu DNI cerca de tu cara. Asegurate que se vea tu rostro y el DNI claramente.
                </div>
                <div style={{ marginBottom: 20 }}>
                  <CapturaImagen
                    label="Selfie con DNI en mano"
                    descripcion="Tu cara + el DNI visibles"
                    icono="🤳"
                    capturado={selfieOk}
                    onCaptura={async (b64, mime) => {
                      await subirImagen("selfie", b64, mime);
                      setSelfieOk(true);
                    }}
                  />
                </div>
                {subiendo && (
                  <div style={{ textAlign: "center", fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                    Subiendo imagen...
                  </div>
                )}
                <button
                  onClick={() => setPaso("firma")}
                  disabled={!selfieOk}
                  style={{
                    width: "100%", background: selfieOk ? RED : "#9ca3af",
                    color: "#fff", border: "none", borderRadius: 12, padding: "14px 0",
                    fontSize: 15, fontWeight: 700, cursor: selfieOk ? "pointer" : "not-allowed"
                  }}>
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* ── Paso 4: Firma ── */}
          {paso === "firma" && (
            <div style={cardStyle}>
              <div style={{ padding: 24 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 4 }}>✍ Tu firma</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
                  Dibujá tu firma en el recuadro. Podés borrar y volver a intentarlo.
                </div>
                <CanvasFirma
                  onFirma={async (b64) => {
                    await subirImagen("firma", b64, "image/png");
                    setFirmaOk(true);
                  }}
                />
                {firmaOk && (
                  <div style={{ background: "#d1fae5", color: "#065f46", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>
                    ✅ Firma capturada
                  </div>
                )}
                {subiendo && (
                  <div style={{ textAlign: "center", fontSize: 12, color: "#6b7280", margin: "12px 0" }}>
                    Guardando firma...
                  </div>
                )}
                {firmaOk && (
                  <button
                    onClick={completarFirma}
                    disabled={firmando}
                    style={{
                      width: "100%", background: firmando ? "#9ca3af" : RED,
                      color: "#fff", border: "none", borderRadius: 12, padding: "14px 0",
                      fontSize: 15, fontWeight: 700, cursor: firmando ? "not-allowed" : "pointer",
                      marginTop: 12
                    }}>
                    {firmando ? "Firmando..." : "✅ Firmar documento"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Paso: Completado ── */}
          {paso === "completado" && (
            <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#111", marginBottom: 8 }}>
                ¡Documento firmado!
              </div>
              <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 24, lineHeight: 1.6 }}>
                Firmaste <strong>{doc.nombre_documento}</strong> correctamente.<br />
                {agencyName} recibirá la confirmación.
              </div>
              <div style={{
                background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12,
                padding: 16, fontSize: 13, color: "#065f46"
              }}>
                📧 Vas a recibir una copia por email a <strong>{doc.firmante_email}</strong>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
