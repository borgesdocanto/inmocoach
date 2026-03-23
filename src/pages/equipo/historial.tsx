import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import AppLayout from "../../components/AppLayout";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Flame } from "lucide-react";

const RED = "#aa0000";
const GREEN = "#16a34a";

interface WeekStat { week_start: string; iac: number; green_total: number; }
interface RankConfig { slug: string; label: string; icon: string; min_iac_up: number; min_iac_keep: number; sort_order: number; }
interface HistoryData {
  agent: { name: string; email: string; image?: string; rankSlug: string; streakCurrent: number; streakBest: number; };
  weeklyGoal: number;
  weeklyStats: WeekStat[];
  rankConfig: RankConfig[];
  summary: {
    avg4: number; avgPrev4: number; trend: number;
    activeStreak: number; consistency: number;
    bestWeek: WeekStat | null; totalActiveWeeks: number;
  };
}

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function iacColor(iac: number): string {
  if (iac >= 100) return GREEN;
  if (iac >= 67) return "#d97706";
  if (iac > 0) return RED;
  return "#e5e7eb";
}

function TrendBadge({ value }: { value: number }) {
  if (value > 5) return (
    <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-xl" style={{ background: "#f0fdf4", color: GREEN }}>
      <TrendingUp size={12} /> +{value}pts vs 4 sem. anteriores
    </span>
  );
  if (value < -5) return (
    <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-xl" style={{ background: "#fef2f2", color: RED }}>
      <TrendingDown size={12} /> {value}pts vs 4 sem. anteriores
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-xl" style={{ background: "#f9fafb", color: "#6b7280" }}>
      <Minus size={12} /> Estable
    </span>
  );
}

function CustomTooltip({ active, payload, label, weeklyGoal }: any) {
  if (!active || !payload?.length) return null;
  const iac = payload[0]?.value ?? 0;
  const greens = payload[1]?.value ?? 0;
  return (
    <div className="bg-gray-900 rounded-xl px-4 py-3 shadow-2xl text-white" style={{ fontSize: 12, minWidth: 140 }}>
      <div className="font-bold text-gray-300 mb-2">Semana {label}</div>
      <div className="flex items-center justify-between gap-4 mb-1">
        <span className="text-gray-400">IAC</span>
        <span className="font-black" style={{ color: iacColor(iac) }}>{iac}%</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-gray-400">Reuniones</span>
        <span className="font-black text-white">{greens}/{weeklyGoal}</span>
      </div>
    </div>
  );
}

export default function AgentHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { email } = router.query;
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"iac" | "greens">("iac");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status]);

  useEffect(() => {
    if (!email || status !== "authenticated") return;
    fetch(`/api/analytics/agent-history?agentEmail=${email}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [email, status]);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: RED, borderTopColor: "transparent" }} />
      </div>
    );
  }

  const { agent, weeklyStats, summary, rankConfig, weeklyGoal } = data;
  const currentRank = rankConfig.find(r => r.slug === agent.rankSlug) ?? rankConfig[0];
  const nextRank = rankConfig.find(r => r.sort_order === (currentRank?.sort_order ?? 0) + 1);

  // Chart data — últimas 26 semanas
  const chartData = weeklyStats.map(w => ({
    label: weekLabel(w.week_start),
    iac: w.iac,
    greens: w.green_total,
    week: w.week_start,
  }));

  // Heatmap de actividad — últimas 12 semanas en grilla 3×4
  const heatmapWeeks = weeklyStats.slice(-12);

  return (
    <AppLayout greeting={`Historial de ${agent.name.split(" ")[0]}`}>
      <Head><title>{agent.name} — Historial · InmoCoach</title></Head>

      <style>{`
        .hs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .hs-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .hs-logros { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .hs-heatmap { display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; }
        @media (max-width: 900px) { .hs-kpis { grid-template-columns: repeat(2, 1fr); } .hs-logros { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 640px) { .hs-grid { grid-template-columns: 1fr; } .hs-heatmap { grid-template-columns: repeat(6, 1fr); } .hs-logros { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ padding: "24px 24px 60px" }}>

        {/* Agent header */}
        <div style={{ background: "#111827", borderRadius: 14, padding: "20px 24px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {agent.image
            ? <img src={agent.image} alt="" style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0, border: `2px solid ${iacColor(summary.avg4)}` }} />
            : <div style={{ width: 52, height: 52, borderRadius: "50%", background: RED, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 500, color: "#fff", flexShrink: 0 }}>
                {agent.name[0]}
              </div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: "#fff", fontFamily: "Georgia, serif" }}>{agent.name}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
              {weeklyStats.length} semanas de historial · {weeklyStats.filter(w => w.iac > 0).length} activas
            </div>
          </div>
          {currentRank && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22 }}>{currentRank.icon}</span>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Rango actual</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{currentRank.label}</div>
                </div>
              </div>
              {nextRank && (
                <div style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 22, opacity: 0.5 }}>{nextRank.icon}</span>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Próximo</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{nextRank.label}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="hs-kpis" style={{ marginBottom: 16 }}>
          {[
            { label: "IAC promedio reciente", value: `${summary.avg4}%`, color: iacColor(summary.avg4), sub: <TrendBadge value={summary.trend} /> },
            { label: "Consistencia", value: `${summary.consistency}%`, color: "#374151", sub: "sem. activas (últ. 12)" },
            { label: "Racha activa", value: summary.activeStreak, color: "#374151", sub: "semanas consecutivas" },
            { label: "Mejor semana", value: summary.bestWeek?.green_total ?? 0, color: "#16a34a", sub: summary.bestWeek ? `sem. ${weekLabel(summary.bestWeek.week_start)}` : "sin datos" },
          ].map((k, i) => (
            <div key={i} style={{ background: "#fff", border: `0.5px solid ${k.color}20`, borderTop: `3px solid ${k.color}`, borderRadius: "0 0 12px 12px", padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{k.label}</div>
              <div style={{ fontSize: 32, fontWeight: 500, fontFamily: "Georgia, serif", color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Gráfico principal */}
        <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>Tendencia semanal</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Últimas {weeklyStats.length} semanas</div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["iac", "greens"] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  fontSize: 11, fontWeight: 500, background: view === v ? "#111827" : "#f3f4f6",
                  color: view === v ? "#fff" : "#9ca3af", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer"
                }}>{v === "iac" ? "IAC %" : "Reuniones"}</button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            {view === "iac" ? (
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#d1d5db" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#d1d5db" }} axisLine={false} tickLine={false} domain={[0, Math.max(120, ...chartData.map(d => d.iac))]} />
                <Tooltip content={<CustomTooltip weeklyGoal={weeklyGoal} />} />
                <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1.5} />
                <ReferenceLine y={67} stroke="#d97706" strokeDasharray="3 3" strokeWidth={1} />
                <Line type="monotone" dataKey="iac" stroke={RED} strokeWidth={2.5}
                  dot={(props: any) => <circle key={props.payload.week} cx={props.cx} cy={props.cy} r={4} fill={iacColor(props.payload.iac)} stroke="white" strokeWidth={2} />}
                  activeDot={{ r: 6 }} />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#d1d5db" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#d1d5db" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip weeklyGoal={weeklyGoal} />} />
                <ReferenceLine y={weeklyGoal} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1.5} />
                <Bar dataKey="greens" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.greens >= weeklyGoal ? "#16a34a" : entry.greens >= weeklyGoal * 0.67 ? "#d97706" : entry.greens > 0 ? RED : "#e5e7eb"} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>

          <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
            {[["#16a34a", "IAC ≥ 100%"], ["#d97706", "IAC 67–99%"], [RED, "IAC < 67%"], ["#e5e7eb", "Sin actividad"]].map(([color, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap */}
        <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Actividad — últimas 12 semanas</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 14 }}>Cada celda es una semana. El color indica el nivel de IAC.</div>
          <div className="hs-heatmap">
            {Array.from({ length: 12 }).map((_, i) => {
              const week = heatmapWeeks[i];
              const isEmpty = !week || week.iac === 0;
              const color = isEmpty ? "#f3f4f6" : iacColor(week.iac);
              const label = week ? `Sem. ${weekLabel(week.week_start)}: ${week.iac}% IAC · ${week.green_total} reuniones` : "Sin datos";
              return (
                <div key={i} title={label} style={{ aspectRatio: "1", borderRadius: 8, background: color, display: "flex", alignItems: "center", justifyContent: "center", cursor: "default" }}>
                  {week && week.iac > 0 && (
                    <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>{week.iac}%</span>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 10, color: "#d1d5db" }}>← hace 12 semanas</span>
            <span style={{ fontSize: 10, color: "#d1d5db" }}>esta semana →</span>
          </div>
        </div>

        {/* Logros */}
        <div className="hs-logros" style={{ marginBottom: 16 }}>
          {[
            { icon: "🔥", label: "Racha días hábiles", value: agent.streakCurrent, sub: `récord: ${agent.streakBest} días` },
            { icon: "⚡", label: "Semanas activas seguidas", value: summary.activeStreak, sub: "semanas consecutivas" },
            { icon: "📊", label: "Total semanas activas", value: summary.totalActiveWeeks, sub: `de ${weeklyStats.length} en el sistema` },
          ].map((l, i) => (
            <div key={i} style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 28, flexShrink: 0 }}>{l.icon}</div>
              <div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>{l.label}</div>
                <div style={{ fontSize: 28, fontWeight: 500, fontFamily: "Georgia, serif", color: "#111827", lineHeight: 1 }}>{l.value}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{l.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabla detallada */}
        <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>Detalle por semana</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{weeklyStats.filter(w => w.iac > 0).length} activas de {weeklyStats.length}</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid #f3f4f6" }}>
                  {["Semana", "IAC", "Reuniones", "Barra"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: h === "Barra" ? "left" : "center", fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...weeklyStats].reverse().map((w, i) => {
                  const color = iacColor(w.iac);
                  return (
                    <tr key={w.week_start} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "0.5px solid #f9fafb" }}>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "#374151", textAlign: "center" }}>Sem. {weekLabel(w.week_start)}</td>
                      <td style={{ padding: "10px 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: w.iac === 0 ? "#d1d5db" : color }}>{w.iac === 0 ? "—" : `${w.iac}%`}</span>
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>{w.green_total === 0 ? "—" : `${w.green_total}/${weeklyGoal}`}</span>
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ width: 120, height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: color, borderRadius: 2, width: `${Math.min(100, w.iac)}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
