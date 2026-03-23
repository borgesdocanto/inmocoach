import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import { CheckCircle2, Users, User, ArrowRight } from "lucide-react";
import { calcTeamsTotal, pricePerAgent, getTierForAgents, formatPriceARS } from "../../lib/pricing";

const BASE_PRICE = 10500;
const RED = "#aa0000";

export default function PagoExito() {
  const router = useRouter();
  const { agents } = router.query;
  const agentCount = Math.max(1, parseInt((agents as string) || "1", 10));
  const isTeam = agentCount > 1;
  const total = calcTeamsTotal(BASE_PRICE, agentCount);
  const perAgent = pricePerAgent(BASE_PRICE, agentCount);
  const tier = getTierForAgents(agentCount);
  const [planActivated, setPlanActivated] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const poll = async () => {
      try {
        const res = await fetch("/api/subscription");
        const data = await res.json();
        if (data.subscription?.plan !== "free") {
          setPlanActivated(true);
          setTimeout(() => router.push("/"), 2000);
          return;
        }
      } catch {}
      attempts++;
      if (attempts < 10) setTimeout(poll, 1500);
      else router.push("/");
    };
    setTimeout(poll, 2000);
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5f7", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>Suscripción activada — InmoCoach</title></Head>

      <div style={{ maxWidth: 440, width: "100%" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "Georgia, serif", color: "#111827" }}>
            Inmo<span style={{ color: RED }}>Coach</span>
          </div>
        </div>

        {/* Card principal */}
        <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>

          {/* Success header */}
          <div style={{ background: "#111827", padding: "28px 24px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(22,163,74,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CheckCircle2 size={28} color="#4ade80" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, color: "#fff", fontFamily: "Georgia, serif", marginBottom: 4 }}>
              ¡Suscripción activada!
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
              {planActivated ? "Plan activado correctamente" : "Activando tu plan..."}
            </div>
          </div>

          {/* Plan detail */}
          <div style={{ padding: "20px 24px", borderBottom: "0.5px solid #f3f4f6" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isTeam ? <Users size={18} color={RED} /> : <User size={18} color={RED} />}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>
                    {isTeam ? `${tier.label}` : "Plan Individual"}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>
                    {isTeam ? `${agentCount} agentes` : "1 agente"}
                    {isTeam && tier.discountPct > 0 && <span style={{ marginLeft: 6, color: "#16a34a" }}>· -{tier.discountPct}%</span>}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 500, fontFamily: "Georgia, serif", color: RED, lineHeight: 1 }}>
                  {formatPriceARS(total)}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>/mes</div>
              </div>
            </div>
            {isTeam && (
              <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280", background: "#f9fafb", borderRadius: 8, padding: "8px 12px" }}>
                {formatPriceARS(perAgent)}/agente · Podés invitar agentes desde Mi cuenta
              </div>
            )}
          </div>

          {/* Next steps */}
          <div style={{ padding: "16px 24px" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 12 }}>Próximos pasos</div>
            {[
              isTeam ? "Invitá a tus agentes desde Mi cuenta → Invitar agente" : "Sincronizá tu Google Calendar desde el dashboard",
              "Conectá tu API de Tokko Broker para ver el estado de tu cartera",
              "El Inmo Coach genera tu análisis semanal cada lunes",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < 2 ? 8 : 0 }}>
                <span style={{ color: "#16a34a", fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => router.push("/")}
          style={{ width: "100%", background: RED, color: "#fff", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          Ir al dashboard <ArrowRight size={16} />
        </button>

        <div style={{ textAlign: "center", fontSize: 12, color: "#d1d5db", marginTop: 12 }}>
          {planActivated ? "¡Listo! Redirigiendo automáticamente..." : "Activando tu plan..."}
        </div>
      </div>
    </div>
  );
}
