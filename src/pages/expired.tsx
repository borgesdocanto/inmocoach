import Head from "next/head";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";

const RED = "#aa0000";

export default function ExpiredPage() {
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5f7", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>Tu prueba terminó — InmoCoach</title></Head>

      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>

        {/* Logo */}
        <div style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: 24, color: "#111827", marginBottom: 32 }}>
          Inmo<span style={{ color: RED }}>Coach</span>
        </div>

        <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
          {/* Header oscuro */}
          <div style={{ background: "#111827", padding: "28px 28px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏱</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: "#fff", fontFamily: "Georgia, serif", marginBottom: 8 }}>
              Tu período de prueba terminó
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
              {session?.user?.email && (
                <span style={{ color: "rgba(255,255,255,0.6)" }}>{session.user.email} · </span>
              )}
              Para seguir usando InmoCoach activá un plan.
            </div>
          </div>

          {/* Beneficios */}
          <div style={{ padding: "20px 24px" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 14, textAlign: "left" }}>Qué vas a mantener activo:</div>
            {[
              "Tu historial de actividad y análisis del Coach IA",
              "Dashboard de actividad con IAC y racha",
              "Cartera Tokko con estado de fichas",
              "Mail semanal con análisis personalizado",
            ].map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8, textAlign: "left" }}>
                <span style={{ color: "#16a34a", fontSize: 13, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 13, color: "#4b5563" }}>{f}</span>
              </div>
            ))}
          </div>

          {/* Precios rápidos */}
          <div style={{ padding: "0 24px 20px", borderTop: "0.5px solid #f3f4f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, marginTop: 16 }}>
              {[
                { label: "Individual", price: "$10.500", sub: "1 agente" },
                { label: "Equipo", price: "$8.400", sub: "5+ agentes" },
              ].map((p, i) => (
                <div key={i} style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{p.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 500, fontFamily: "Georgia, serif", color: RED }}>{p.price}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>/mes · {p.sub}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => router.push("/pricing")}
              style={{ width: "100%", background: RED, color: "#fff", border: "none", borderRadius: 10, padding: "13px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", marginBottom: 10 }}>
              Ver planes y empezar →
            </button>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Sin contrato · Cancelás cuando querés</div>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af" }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
