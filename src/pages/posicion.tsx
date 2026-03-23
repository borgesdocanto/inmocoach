import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import AppLayout from "../components/AppLayout";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const RED = "#aa0000";

function iacColor(v: number) {
  return v >= 100 ? "#16a34a" : v >= 67 ? "#d97706" : "#dc2626";
}

function iacBg(v: number) {
  return v >= 100 ? "#EAF3DE" : v >= 67 ? "#FAEEDA" : "#FCEBEB";
}

export default function PosicionPage() {
  const { status } = useSession();
  const router = useRouter();
  const [vsTeam, setVsTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/analytics/agent-vs-team")
      .then(r => r.ok ? r.json() : null)
      .then(d => { setVsTeam(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  if (loading || !vsTeam) return (
    <AppLayout><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}><div style={{ fontSize: 13, color: "#9ca3af" }}>Cargando posición...</div></div></AppLayout>
  );

  const { agentIac, teamAvgIac, diff, rank, teamTotal, weeklyHistory, weeklyGoal } = vsTeam;
  const hasTeam = teamAvgIac !== null;

  const chartData = (weeklyHistory ?? []).map((w: any) => ({
    label: (() => { const d = new Date(w.week_start + "T12:00:00"); return `${d.getDate()}/${d.getMonth() + 1}`; })(),
    iac: w.iac,
    greens: w.green_total,
  }));

  const avg4 = chartData.length >= 4
    ? Math.round(chartData.slice(-4).reduce((s: number, w: any) => s + w.iac, 0) / 4)
    : agentIac;

  const diffMsg = !hasTeam ? null
    : rank === 1 ? "🏆 Sos el mejor del equipo esta semana"
    : diff > 10 ? `🔥 Estás ${diff}pts sobre el promedio`
    : diff > 0 ? `💪 Sobre el promedio del equipo`
    : diff === 0 ? "En el promedio del equipo"
    : `📉 ${Math.abs(diff)}pts bajo el promedio`;

  return (
    <AppLayout greeting={greeting}>
      <Head><title>Posición en el equipo — InmoCoach</title></Head>

      <style>{`
        .pos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 767px) { .pos-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ padding: "24px 24px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>← Inicio</button>
          <div style={{ fontSize: 22, fontWeight: 500, color: "#111827", fontFamily: "Georgia, serif" }}>Posición en el equipo</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Tu IAC comparado con el equipo esta semana</div>
        </div>

        {!hasTeam ? (
          <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⊙</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#111827", marginBottom: 6 }}>No pertenecés a un equipo</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Cuando te sumes a un equipo vas a ver tu posición acá</div>
          </div>
        ) : (
          <>
            {/* Banner vs equipo */}
            <div style={{ background: "#111827", borderRadius: 14, padding: "20px", marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Tu IAC</div>
                  <div style={{ fontSize: 48, fontWeight: 500, fontFamily: "Georgia, serif", color: iacColor(agentIac), lineHeight: 1 }}>{agentIac}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Promedio equipo</div>
                  <div style={{ fontSize: 48, fontWeight: 500, fontFamily: "Georgia, serif", color: "#fff", lineHeight: 1 }}>{teamAvgIac}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Diferencia</div>
                  <div style={{ fontSize: 48, fontWeight: 500, fontFamily: "Georgia, serif", lineHeight: 1, color: diff > 0 ? "#4ade80" : diff < 0 ? "#f87171" : "#9ca3af" }}>
                    {diff > 0 ? "+" : ""}{diff}%
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: diff > 0 ? "#86efac" : diff < 0 ? "#fca5a5" : "#9ca3af", marginBottom: 12 }}>
                {diffMsg} · Posición {rank} de {teamTotal}
              </div>
              {/* Barra de diferencia */}
              <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.2)" }} />
                {diff !== 0 && (
                  <div style={{
                    position: "absolute", top: 0, bottom: 0, borderRadius: 3,
                    background: diff > 0 ? "#4ade80" : "#f87171",
                    width: `${Math.min(50, Math.abs(diff) / 2)}%`,
                    left: diff > 0 ? "50%" : `${50 - Math.min(50, Math.abs(diff) / 2)}%`,
                  }} />
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Por debajo del promedio</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Por encima del promedio</span>
              </div>
            </div>

            <div className="pos-grid">
              {/* Evolución personal */}
              {chartData.length > 0 && (
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>Tu evolución</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>Prom. 4 sem: <span style={{ color: iacColor(avg4), fontWeight: 500 }}>{avg4}%</span></div>
                  </div>
                  <div style={{ padding: 16 }}>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={[0, 110]} />
                        <Tooltip content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div style={{ background: "#111827", borderRadius: 8, padding: "8px 12px" }}>
                              <div style={{ fontSize: 11, color: "#9ca3af" }}>Sem. {d.label}</div>
                              <div style={{ fontSize: 14, fontWeight: 500, color: iacColor(d.iac) }}>{d.iac}%</div>
                            </div>
                          );
                        }} />
                        <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1} />
                        <ReferenceLine y={67} stroke="#d97706" strokeDasharray="3 3" strokeWidth={1} />
                        <Line type="monotone" dataKey="iac" stroke={RED} strokeWidth={2}
                          dot={(props: any) => <circle key={props.payload.label} cx={props.cx} cy={props.cy} r={3} fill={iacColor(props.payload.iac)} stroke="white" strokeWidth={1.5} />}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    {/* Heatmap */}
                    <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
                      {chartData.map((w: any, i: number) => (
                        <div key={i} title={`Sem. ${w.label}: ${w.iac}%`} style={{ flex: 1, height: 6, borderRadius: 2, background: iacColor(w.iac), opacity: w.iac > 0 ? 1 : 0.2 }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Resumen semanal */}
              <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #f3f4f6" }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>Últimas semanas</div>
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {[...chartData].reverse().slice(0, 10).map((w: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "0.5px solid #f9fafb" }}>
                      <div style={{ fontSize: 12, color: "#9ca3af", minWidth: 40 }}>{w.label}</div>
                      <div style={{ flex: 1, height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: iacColor(w.iac), borderRadius: 3, width: `${Math.min(100, w.iac)}%` }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: iacColor(w.iac), minWidth: 36, textAlign: "right" }}>{w.iac}%</div>
                      <div style={{ fontSize: 11, background: iacBg(w.iac), color: iacColor(w.iac), borderRadius: 6, padding: "2px 7px", minWidth: 60, textAlign: "center" }}>
                        {w.greens}/{weeklyGoal ?? 15}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
