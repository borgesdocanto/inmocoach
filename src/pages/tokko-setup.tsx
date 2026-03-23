import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import { CheckCircle2, Unlink, ExternalLink } from "lucide-react";
import AppLayout from "../components/AppLayout";

const RED = "#aa0000";

export default function TokkoSetup() {
  const router = useRouter();
  const { status } = useSession();
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [tokkoSummary, setTokkoSummary] = useState<{ properties: number; agents: number } | null>(null);

  // Estado actual de conexión
  const [loading, setLoading] = useState(true);
  const [hasKey, setHasKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; properties?: number; agents?: number } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/teams/tokko-config")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) { setHasKey(d.hasKey); setKeyPreview(d.keyPreview); }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status]);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/teams/tokko-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const d = await r.json();
      if (d.ok) {
        setHasKey(true); setKeyPreview(`${"•".repeat(apiKey.length - 4)}${apiKey.slice(-4)}`);
        setSaved(true);
        const test = await fetch("/api/admin/tokko-test", { method: "POST" });
        const td = await test.json();
        if (td.ok) setTokkoSummary({ properties: td.properties ?? 0, agents: td.users ?? 0 });
        setTimeout(() => router.push("/cuenta"), 4000);
      } else {
        setError(d.error || "API key inválida.");
      }
    } catch { setError("Error de conexión."); }
    setSaving(false);
  };

  const handleDisconnect = async () => {
    if (!confirm("¿Desvincular Tokko? Se eliminarán los datos sincronizados.")) return;
    setDisconnecting(true);
    await fetch("/api/teams/tokko-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remove: true }),
    });
    setHasKey(false); setKeyPreview(null); setTestResult(null);
    setApiKey(""); setSaved(false); setTokkoSummary(null);
    setDisconnecting(false);
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await fetch("/api/admin/tokko-test", { method: "POST" });
      const d = await r.json();
      setTestResult({ ok: d.ok, properties: d.properties, agents: d.users });
    } catch { setTestResult({ ok: false }); }
    setTesting(false);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  return (
    <AppLayout greeting={greeting}>
      <Head><title>Conectar Tokko — InmoCoach</title></Head>

      <style>{`
        .tokko-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 767px) { .tokko-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ padding: "28px 28px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
            Configuración → Tokko Broker
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 22, fontWeight: 500, color: "#111827", fontFamily: "Georgia, serif" }}>
              Conectá tu cartera de Tokko
            </div>
            {!loading && hasKey && (
              <span style={{ fontSize: 12, fontWeight: 500, background: "#EAF3DE", color: "#3B6D11", borderRadius: 8, padding: "4px 10px" }}>
                ✓ Conectado
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, marginTop: 6, maxWidth: 600 }}>
            Gracias a la API Key de Tokko Broker vas a poder ver el estado de tus fichas,
            alertas de actualización y propiedades incompletas directamente en tu dashboard.
          </div>
        </div>

        {loading ? (
          <div style={{ color: "#9ca3af", fontSize: 13 }}>Cargando...</div>
        ) : hasKey ? (
          /* ── ESTADO CONECTADO ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>

            {/* Card estado */}
            <div style={{ background: "#fff", border: "0.5px solid #86efac", borderTop: "3px solid #16a34a", borderRadius: "0 0 14px 14px", overflow: "hidden" }}>
              <div style={{ background: "#EAF3DE", padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CheckCircle2 size={22} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 500, color: "#166534" }}>Tokko conectado</div>
                    <div style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>Sincronización automática activa</div>
                  </div>
                </div>
                {keyPreview && (
                  <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>API Key</span>
                    <span style={{ fontSize: 13, fontFamily: "monospace", color: "#374151", flex: 1 }}>{keyPreview}</span>
                    <a href="https://www.tokkobroker.com" target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#16a34a", textDecoration: "none" }}>
                      Abrir Tokko <ExternalLink size={11} />
                    </a>
                  </div>
                )}
              </div>

              {/* Test resultado */}
              {testResult && (
                <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #f3f4f6", background: testResult.ok ? "#f0fdf4" : "#FEF2F2" }}>
                  {testResult.ok ? (
                    <div style={{ display: "flex", gap: 16 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 24, fontWeight: 500, fontFamily: "Georgia, serif", color: "#16a34a" }}>{testResult.properties}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>propiedades</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 24, fontWeight: 500, fontFamily: "Georgia, serif", color: "#16a34a" }}>{testResult.agents}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>agentes</div>
                      </div>
                      {(testResult.agents ?? 0) > 0 && (
                        <button onClick={() => router.push("/cuenta")}
                          style={{ marginLeft: "auto", background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                          Invitar agentes →
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#dc2626" }}>✗ Error al conectar con Tokko — verificá la API key</div>
                  )}
                </div>
              )}

              {/* Acciones */}
              <div style={{ padding: "14px 20px", display: "flex", gap: 10 }}>
                <button onClick={handleTest} disabled={testing}
                  style={{ fontSize: 12, color: "#374151", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>
                  {testing ? "Probando..." : "Probar conexión"}
                </button>
                <button onClick={() => router.push("/cartera")}
                  style={{ fontSize: 12, color: "#374151", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>
                  Ver cartera →
                </button>
                <button onClick={handleDisconnect} disabled={disconnecting}
                  style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#dc2626", background: "#FEF2F2", border: "0.5px solid #fecaca", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>
                  <Unlink size={13} />
                  {disconnecting ? "Desvinculando..." : "Desvincular"}
                </button>
              </div>
            </div>

            {/* Actualizar key */}
            <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Actualizar API Key</div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>Si cambiaste tu key en Tokko, pegá la nueva acá</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSave()}
                  placeholder="Nueva API Key"
                  style={{ flex: 1, border: "0.5px solid #d1d5db", borderRadius: 10, padding: "9px 12px", fontSize: 13, fontFamily: "monospace", outline: "none", background: "#f9fafb", boxSizing: "border-box" as const }} />
                <button onClick={handleSave} disabled={saving || !apiKey.trim()}
                  style={{ background: apiKey.trim() ? RED : "#e5e7eb", color: apiKey.trim() ? "#fff" : "#9ca3af", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 12, fontWeight: 500, cursor: apiKey.trim() ? "pointer" : "not-allowed" }}>
                  {saving ? "Guardando..." : "Actualizar"}
                </button>
              </div>
              {error && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>⚠ {error}</div>}
            </div>
          </div>
        ) : (
          /* ── ESTADO NO CONECTADO ── */
          <div className="tokko-grid">

            {/* Izquierda — GIF + pasos */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #f3f4f6" }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>Cómo encontrar tu API Key en Tokko</div>
                </div>
                <img
                  src="https://downloads.intercomcdn.com/i/o/72858699/0e637cedd7e0219e5fb8f168/118.gif?expires=1774226700&signature=cfd5956319187e731b8a64e861527fac4eb58e7a3d15babef34c0866aef9d3ab&req=cyIvE8F4lIgTWLcX3D%2B5hhi6feU18heq0FujpNulTTMlDF%2B%2FepdgkLHP4Ksa%0AxZSSjFaBc2CxoBsR%0A"
                  alt="Cómo encontrar la API Key en Tokko"
                  style={{ width: "100%", display: "block" }}
                />
              </div>

              <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: "20px" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 16 }}>Seguí estos pasos</div>
                {[
                  { n: 1, text: <>Ingresá en Tokko y hacé click en <strong style={{ color: "#111827" }}>Mi Empresa</strong></> },
                  { n: 2, text: <>Hacé click en <strong style={{ color: "#111827" }}>Permisos</strong></> },
                  { n: 3, text: <>En la sección <strong style={{ color: "#111827" }}>API Key</strong> copiá el código</> },
                  { n: 4, text: <>Pegalo en el campo de la derecha y guardalo</> },
                ].map((step, i, arr) => (
                  <div key={step.n} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: i < arr.length - 1 ? 14 : 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: RED, color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{step.n}</div>
                    <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6, paddingTop: 4 }}>{step.text}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Derecha — input + beneficios */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: "24px" }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: "#111827", marginBottom: 6 }}>Tu API Key de Tokko</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
                  Conectá InmoCoach con tu cartera de propiedades en segundos.
                </div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 6 }}>API Key</label>
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSave()}
                  placeholder="Pegá tu API Key acá"
                  style={{ width: "100%", fontSize: 13, border: "0.5px solid #d1d5db", borderRadius: 10, padding: "11px 14px", fontFamily: "monospace", outline: "none", marginBottom: 16, background: "#f9fafb", boxSizing: "border-box" as const }} />
                {error && (
                  <div style={{ fontSize: 12, color: "#dc2626", background: "#FEF2F2", border: "0.5px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
                    ⚠ {error}
                  </div>
                )}
                {saved ? (
                  <div style={{ background: "#EAF3DE", border: "0.5px solid #86efac", borderRadius: 12, padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: tokkoSummary ? 14 : 0 }}>
                      <CheckCircle2 size={20} style={{ color: "#16a34a", flexShrink: 0 }} />
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#166534" }}>¡Tokko conectado correctamente!</div>
                    </div>
                    {tokkoSummary && (
                      <>
                        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                          <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                            <div style={{ fontSize: 28, fontWeight: 500, fontFamily: "Georgia, serif", color: "#16a34a" }}>{tokkoSummary.properties}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>propiedades</div>
                          </div>
                          <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                            <div style={{ fontSize: 28, fontWeight: 500, fontFamily: "Georgia, serif", color: "#16a34a" }}>{tokkoSummary.agents}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>agentes</div>
                          </div>
                        </div>
                        {(tokkoSummary.agents ?? 0) > 0 && (
                          <button onClick={() => router.push("/cuenta")}
                            style={{ width: "100%", background: RED, color: "#fff", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                            Invitar agentes de Tokko a InmoCoach →
                          </button>
                        )}
                      </>
                    )}
                    {!tokkoSummary && <div style={{ fontSize: 12, color: "#166534" }}>Sincronizando datos...</div>}
                  </div>
                ) : (
                  <button onClick={handleSave} disabled={saving || !apiKey.trim()}
                    style={{ width: "100%", background: apiKey.trim() ? RED : "#e5e7eb", color: apiKey.trim() ? "#fff" : "#9ca3af", border: "none", borderRadius: 10, padding: "13px 0", fontSize: 14, fontWeight: 500, cursor: apiKey.trim() ? "pointer" : "not-allowed" }}>
                    {saving ? "Verificando conexión..." : "Guardar y conectar"}
                  </button>
                )}
              </div>

              <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: "20px" }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 10 }}>🔒 Tu información está segura</div>
                {["Tu API Key se guarda cifrada y nunca se comparte.", "InmoCoach solo lee — nunca escribe datos en Tokko.", "Podés desconectar en cualquier momento."].map((txt, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < 2 ? 8 : 0 }}>
                    <span style={{ color: "#16a34a", fontSize: 12 }}>✓</span>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{txt}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: "20px" }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 10 }}>✦ Qué vas a poder ver</div>
                {["Propiedades disponibles y estado de ficha en tu dashboard", "Alertas de fichas incompletas — fotos, plano, video", "Propiedades sin actualizar hace más de 30 días", "El coach incluye tu cartera en sus análisis"].map((txt, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < 3 ? 8 : 0 }}>
                    <span style={{ color: RED, fontSize: 12 }}>→</span>
                    <span style={{ fontSize: 12, color: "#4b5563" }}>{txt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
