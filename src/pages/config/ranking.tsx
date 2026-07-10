import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import AppLayout from "../../components/AppLayout";
import { Loader2 } from "lucide-react";

const RED = "#aa0000";

function Toggle({ val, onChange }: { val: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!val)} style={{
      position: "relative", width: 40, height: 22, borderRadius: 11,
      background: val ? RED : "#e5e7eb", cursor: "pointer", flexShrink: 0, transition: "background 0.2s"
    }}>
      <div style={{
        position: "absolute", top: 2, width: 18, height: 18, background: "#fff",
        borderRadius: "50%", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
        left: val ? "calc(100% - 20px)" : 2
      }} />
    </div>
  );
}

export default function RankingConfigPage() {
  const { status } = useSession();
  const router = useRouter();
  const [showBroker, setShowBroker] = useState(true);
  const [showTeamLeaders, setShowTeamLeaders] = useState(true);
  const [anonymizeGlobal, setAnonymizeGlobal] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [agencyInput, setAgencyInput] = useState("");
  const [agencySaving, setAgencySaving] = useState(false);
  const [agencyMsg, setAgencyMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    
    // Verificar que sea owner o team_leader
    fetch("/api/subscription")
      .then(r => r.json())
      .then(d => {
        const role = d.subscription?.teamRole;
        if (role !== "owner" && role !== "team_leader") {
          router.replace("/");
          return;
        }
        
        return Promise.all([
          fetch("/api/teams/settings").then(r => r.ok ? r.json() : null),
          fetch("/api/teams/agency").then(r => r.ok ? r.json() : null),
        ]);
      })
      .then(([settings, agency]) => {
        if (settings) {
          setShowBroker(settings.showBroker ?? true);
          setShowTeamLeaders(settings.showTeamLeaders ?? true);
          setAnonymizeGlobal(settings.anonymizeGlobal ?? false);
        }
        if (agency?.agencyName) {
          setAgencyName(agency.agencyName);
          setAgencyInput(agency.agencyName);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [status, router]);

  const saveSetting = async (key: string, value: boolean) => {
    setSaving(true);
    await fetch("/api/teams/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  };

  const saveAgency = async () => {
    setAgencySaving(true);
    const r = await fetch("/api/teams/agency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencyName: agencyInput }),
    });
    const d = await r.json();
    if (d.ok) { setAgencyName(agencyInput); setAgencyMsg("Guardado ✓"); setTimeout(() => setAgencyMsg(""), 2000); }
    setAgencySaving(false);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  const settings = [
    {
      key: "showBroker", val: showBroker, set: setShowBroker,
      label: "Mostrar Broker en el ranking",
      sub: "Si está desactivado, el broker no aparece en el ranking interno del equipo",
    },
    {
      key: "showTeamLeaders", val: showTeamLeaders, set: setShowTeamLeaders,
      label: "Mostrar Team Leaders en el ranking",
      sub: "Si está desactivado, solo aparecen los agentes (members) en el ranking",
    },
    {
      key: "anonymizeGlobal", val: anonymizeGlobal, set: setAnonymizeGlobal,
      label: "Anonimizar equipo en el ranking global",
      sub: 'Los agentes aparecen como "Agente #N" en comparativas públicas entre equipos',
    },
  ];

  return (
    <AppLayout greeting={greeting}>
      <Head><title>Configuración de Ranking — InmoCoach</title></Head>

      <div style={{ padding: "24px 24px 60px", maxWidth: 600 }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
            Configuración → Ranking
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "#111827", fontFamily: "Georgia, serif" }}>
            Ranking del equipo
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            Configurá cómo se muestran los usuarios en el ranking interno y global.
          </div>
        </div>

        {loading ? (
          <div style={{ color: "#9ca3af", fontSize: 13 }}>Cargando...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Nombre de la inmobiliaria */}
            <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 4 }}>Nombre de la inmobiliaria</div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>
                Se muestra en el dashboard del equipo y en el sidebar. Si usás Tokko, lo detectamos automáticamente de tu sucursal.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={agencyInput}
                  onChange={e => setAgencyInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveAgency()}
                  placeholder="Ej: GALAS Propiedades"
                  style={{ flex: 1, border: "0.5px solid #d1d5db", borderRadius: 10, padding: "9px 12px", fontSize: 13, outline: "none", background: "#f9fafb" }}
                />
                <button
                  onClick={saveAgency}
                  disabled={agencySaving || agencyInput === agencyName}
                  style={{ background: agencyInput !== agencyName ? RED : "#e5e7eb", color: agencyInput !== agencyName ? "#fff" : "#9ca3af", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 12, fontWeight: 500, cursor: agencyInput !== agencyName ? "pointer" : "not-allowed" }}>
                  {agencySaving ? "..." : "Guardar"}
                </button>
              </div>
              {agencyMsg && <div style={{ fontSize: 11, color: "#16a34a", marginTop: 6 }}>{agencyMsg}</div>}
            </div>

            {/* Toggles */}
            <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>Visibilidad en el ranking</span>
                {saving && <Loader2 size={12} style={{ color: "#9ca3af" }} className="animate-spin" />}
                {saved && <span style={{ fontSize: 11, color: "#16a34a" }}>✓ Guardado</span>}
              </div>
              {settings.map((s, i) => (
                <div key={s.key} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px",
                  borderBottom: i < settings.length - 1 ? "0.5px solid #f9fafb" : "none",
                }}>
                  <div style={{ flex: 1, paddingRight: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3, lineHeight: 1.5 }}>{s.sub}</div>
                  </div>
                  <Toggle val={s.val} onChange={v => { s.set(v); saveSetting(s.key, v); }} />
                </div>
              ))}
            </div>

            {/* Info */}
            <div style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.7 }}>
                Estos ajustes no afectan el acceso ni el costo del plan. Solo controlan cómo se presentan los usuarios en las vistas de ranking interno y comparativas.
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
