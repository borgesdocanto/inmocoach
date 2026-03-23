import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { CheckCircle2 } from "lucide-react";
import AppLayout from "../components/AppLayout";

const RED = "#aa0000";

export default function TokkoSetup() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/teams/tokko-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const d = await r.json();
      if (d.ok) {
        setSaved(true);
        setTimeout(() => router.push("/"), 1800);
      } else {
        setError(d.error || "API key inválida. Verificá en Tokko → Mi Empresa → Permisos.");
      }
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    }
    setSaving(false);
  };

  return (
    <AppLayout>
      <Head><title>Conectar Tokko — InmoCoach</title></Head>

      <div style={{ maxWidth: 540, margin: "0 auto", padding: "32px 20px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
            Configuración → Tokko Broker
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "#111827", marginBottom: 8, fontFamily: "Georgia, serif" }}>
            Conectá tu cartera de Tokko
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7 }}>
            Gracias a la API Key de Tokko Broker vas a poder ver el estado de tus fichas,
            alertas de actualización y propiedades incompletas directamente en tu dashboard de InmoCoach.
          </div>
        </div>

        {/* GIF */}
        <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #f3f4f6" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>Cómo encontrar tu API Key en Tokko</div>
          </div>
          <img
            src="https://downloads.intercomcdn.com/i/o/72858699/0e637cedd7e0219e5fb8f168/118.gif?expires=1774226700&signature=cfd5956319187e731b8a64e861527fac4eb58e7a3d15babef34c0866aef9d3ab&req=cyIvE8F4lIgTWLcX3D%2B5hhi6feU18heq0FujpNulTTMlDF%2B%2FepdgkLHP4Ksa%0AxZSSjFaBc2CxoBsR%0A"
            alt="Cómo encontrar la API Key en Tokko"
            style={{ width: "100%", display: "block" }}
          />
        </div>

        {/* Pasos */}
        <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: "20px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 16 }}>Seguí estos pasos</div>
          {[
            { n: 1, text: <>Ingresá en Tokko y hacé click en <strong style={{ color: "#111827" }}>Mi Empresa</strong></> },
            { n: 2, text: <>Hacé click en <strong style={{ color: "#111827" }}>Permisos</strong></> },
            { n: 3, text: <>En la sección <strong style={{ color: "#111827" }}>API Key</strong> seleccioná el código y copialo</> },
            { n: 4, text: <>Pegalo abajo y guardalo para conectar InmoCoach</> },
          ].map((step, i, arr) => (
            <div key={step.n} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: i < arr.length - 1 ? 14 : 0 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: RED, color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{step.n}</div>
              <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6, paddingTop: 4 }}>{step.text}</div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: "20px", marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 8 }}>
            Tu API Key de Tokko
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            placeholder="Pegá tu API Key acá"
            style={{
              width: "100%", fontSize: 13, border: "0.5px solid #d1d5db",
              borderRadius: 10, padding: "10px 14px", fontFamily: "monospace",
              outline: "none", marginBottom: 12, background: "#f9fafb",
              boxSizing: "border-box",
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: "#dc2626", background: "#FEF2F2", border: "0.5px solid #fecaca", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
              {error}
            </div>
          )}
          {saved ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#16a34a", fontSize: 13, fontWeight: 500 }}>
              <CheckCircle2 size={18} />
              Conectado correctamente. Redirigiendo...
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              style={{
                width: "100%", background: apiKey.trim() ? RED : "#e5e7eb",
                color: apiKey.trim() ? "#fff" : "#9ca3af",
                border: "none", borderRadius: 10, padding: "11px 0",
                fontSize: 14, fontWeight: 500, cursor: apiKey.trim() ? "pointer" : "not-allowed",
              }}>
              {saving ? "Verificando..." : "Guardar y conectar"}
            </button>
          )}
        </div>

        <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", lineHeight: 1.6 }}>
          Tu API Key se guarda de forma segura y solo se usa para leer el estado de tus propiedades.<br />
          InmoCoach nunca modifica ni escribe datos en Tokko.
        </div>
      </div>
    </AppLayout>
  );
}
