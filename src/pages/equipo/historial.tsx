import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from "recharts";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Award, Flame, Target, Calendar } from "lucide-react";

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
    <div className="min-h-screen" style={{ background: "#f4f4f5", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>{agent.name} — Historial · InmoCoach</title></Head>
      <div className="h-1 w-full" style={{ background: RED }} />

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href="/equipo" className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={13} /> Equipo
          </Link>
          <div className="flex items-center gap-2 ml-2">
            {agent.image
              ? <img src={agent.image} alt="" className="w-7 h-7 rounded-full" />
              : <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black" style={{ background: RED }}>{agent.name[0]}</div>}
            <span className="font-bold text-sm text-gray-800">{agent.name}</span>
            {currentRank && <span className="text-base">{currentRank.icon}</span>}
          </div>
          <div className="ml-auto text-xs text-gray-400 font-medium">{weeklyStats.length} semanas de historial</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6 space-y-5">

        {/* Hero — fondo oscuro con métricas clave */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
          <div className="px-6 pt-6 pb-5">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Evolución histórica</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-2">
              <div>
                <div className="text-xs text-gray-400 mb-1">IAC promedio reciente</div>
                <div className="text-4xl font-black" style={{ fontFamily: "Georgia, serif", color: summary.avg4 >= 100 ? "#4ade80" : summary.avg4 >= 67 ? "#fbbf24" : "#f87171" }}>
                  {summary.avg4}%
                </div>
                <div className="mt-1"><TrendBadge value={summary.trend} /></div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Consistencia</div>
                <div className="text-4xl font-black text-white" style={{ fontFamily: "Georgia, serif" }}>{summary.consistency}%</div>
                <div className="text-xs text-gray-500 mt-1">de sem. activas (últimas 12)</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Racha activa</div>
                <div className="text-4xl font-black text-white" style={{ fontFamily: "Georgia, serif" }}>{summary.activeStreak}</div>
                <div className="text-xs text-gray-500 mt-1">semanas consecutivas</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Mejor semana</div>
                <div className="text-4xl font-black text-white" style={{ fontFamily: "Georgia, serif" }}>
                  {summary.bestWeek?.green_total ?? 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {summary.bestWeek ? `reuniones (${weekLabel(summary.bestWeek.week_start)})` : "sin datos"}
                </div>
              </div>
            </div>
          </div>

          {/* Rango actual + próximo */}
          {currentRank && (
            <div className="px-6 pb-5 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
                <span className="text-2xl">{currentRank.icon}</span>
                <div>
                  <div className="text-xs text-gray-400">Rango actual</div>
                  <div className="text-sm font-black text-white">{currentRank.label}</div>
                </div>
              </div>
              {nextRank && (
                <>
                  <span className="text-gray-600">→</span>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                    <span className="text-2xl" style={{ filter: "grayscale(0.5)" }}>{nextRank.icon}</span>
                    <div>
                      <div className="text-xs text-gray-500">Próximo</div>
                      <div className="text-sm font-bold text-gray-300">{nextRank.label} — IAC ≥ {nextRank.min_iac_up}%</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Gráfico principal */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <div className="text-sm font-black text-gray-800">Tendencia semanal</div>
              <div className="text-xs text-gray-400 mt-0.5">Últimas {weeklyStats.length} semanas</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setView("iac")}
                className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
                style={{ background: view === "iac" ? RED : "#f3f4f6", color: view === "iac" ? "white" : "#9ca3af" }}>
                IAC %
              </button>
              <button onClick={() => setView("greens")}
                className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
                style={{ background: view === "greens" ? RED : "#f3f4f6", color: view === "greens" ? "white" : "#9ca3af" }}>
                Reuniones
              </button>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            {view === "iac" ? (
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#d1d5db", fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#d1d5db" }} axisLine={false} tickLine={false} domain={[0, Math.max(120, ...chartData.map(d => d.iac))]} />
                <Tooltip content={<CustomTooltip weeklyGoal={weeklyGoal} />} />
                <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "100%", position: "right", fontSize: 10, fill: "#16a34a" }} />
                <ReferenceLine y={67} stroke="#d97706" strokeDasharray="4 4" strokeWidth={1} />
                <Line type="monotone" dataKey="iac" stroke={RED} strokeWidth={2.5}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    return <circle key={payload.week} cx={cx} cy={cy} r={4} fill={iacColor(payload.iac)} stroke="white" strokeWidth={2} />;
                  }}
                  activeDot={{ r: 6 }} />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#d1d5db", fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#d1d5db" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip weeklyGoal={weeklyGoal} />} />
                <ReferenceLine y={weeklyGoal} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Meta ${weeklyGoal}`, position: "right", fontSize: 10, fill: "#16a34a" }} />
                <Bar dataKey="greens" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.greens >= weeklyGoal ? GREEN : entry.greens >= weeklyGoal * 0.67 ? "#d97706" : entry.greens > 0 ? RED : "#e5e7eb"} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>

          {/* Leyenda */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {[["#16a34a", "IAC ≥ 100%"], ["#d97706", "IAC 67–99%"], [RED, "IAC < 67%"], ["#e5e7eb", "Sin actividad"]].map(([color, label]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span className="text-xs text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap de últimas 12 semanas */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="text-sm font-black text-gray-800 mb-1">Actividad — últimas 12 semanas</div>
          <div className="text-xs text-gray-400 mb-4">Cada celda es una semana. El color indica el nivel de IAC.</div>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
            {Array.from({ length: 12 }).map((_, i) => {
              const week = heatmapWeeks[i];
              const isEmpty = !week || week.iac === 0;
              const color = isEmpty ? "#f3f4f6" : iacColor(week.iac);
              const label = week ? `Sem. ${weekLabel(week.week_start)}: ${week.iac}% IAC · ${week.green_total} reuniones` : "Sin datos";
              return (
                <div key={i} title={label}
                  className="aspect-square rounded-xl flex flex-col items-center justify-center cursor-default transition-transform hover:scale-110"
                  style={{ background: color }}>
                  {week && week.iac > 0 && (
                    <span className="text-white font-black" style={{ fontSize: 11 }}>{week.iac}%</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-400">← hace 12 semanas</span>
            <span className="text-xs text-gray-400">esta semana →</span>
          </div>
        </div>

        {/* Tabla detallada */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="text-sm font-black text-gray-800">Detalle por semana</div>
            <div className="text-xs text-gray-400">{weeklyStats.filter(w => w.iac > 0).length} semanas activas de {weeklyStats.length}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Semana</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">IAC</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">Reuniones</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Barra</th>
                </tr>
              </thead>
              <tbody>
                {[...weeklyStats].reverse().map((w, i) => {
                  const color = iacColor(w.iac);
                  const barW = Math.min(100, w.iac);
                  return (
                    <tr key={w.week_start} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-6 py-3 text-sm font-medium text-gray-700">
                        Sem. {weekLabel(w.week_start)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-black" style={{ color: w.iac === 0 ? "#d1d5db" : color }}>
                          {w.iac === 0 ? "—" : `${w.iac}%`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-gray-600">
                          {w.green_total === 0 ? "—" : `${w.green_total}/${weeklyGoal}`}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="w-full max-w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${barW}%`, background: color }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Racha y logros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4">
            <div className="text-3xl">🔥</div>
            <div>
              <div className="text-xs text-gray-400 font-medium mb-0.5">Racha días hábiles</div>
              <div className="text-2xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{agent.streakCurrent}</div>
              <div className="text-xs text-gray-400">récord: {agent.streakBest} días</div>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4">
            <div className="text-3xl"><Flame size={28} className="text-orange-400" /></div>
            <div>
              <div className="text-xs text-gray-400 font-medium mb-0.5">Semanas activas seguidas</div>
              <div className="text-2xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{summary.activeStreak}</div>
              <div className="text-xs text-gray-400">semanas consecutivas activas</div>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4">
            <div className="text-3xl">📊</div>
            <div>
              <div className="text-xs text-gray-400 font-medium mb-0.5">Total semanas activas</div>
              <div className="text-2xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{summary.totalActiveWeeks}</div>
              <div className="text-xs text-gray-400">de {weeklyStats.length} semanas en el sistema</div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
