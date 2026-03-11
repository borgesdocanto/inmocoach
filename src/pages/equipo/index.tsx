import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import {
  ArrowLeft, Loader2, Users,
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  ChevronRight, Flame, RefreshCw
} from "lucide-react";

const RED = "#aa0000";
const IAC_GOAL = 15;

type TeamRole = "owner" | "team_leader" | "member";

interface AgentSummary {
  email: string; name?: string; avatar?: string; teamRole: TeamRole;
  weekTotal: number; weekProductiveDays: number; iac: number;
  monthTotal: number; trend: "up" | "down" | "stable"; trendPct: number;
  status: "green" | "yellow" | "red"; sparkline: number[]; streak: number;
}
interface TeamOverview {
  totalAgents: number; weekTotalMeetings: number;
  greenAgents: number; yellowAgents: number; redAgents: number;
  topAgent: string | null; needsAttention: string | null;
}

const iacColor = (iac: number) => iac >= 70 ? "#16a34a" : iac >= 40 ? "#d97706" : "#aa0000";
const iacLabel = (iac: number) => iac >= 70 ? "Productivo" : iac >= 40 ? "En construcción" : "En riesgo";
const iacBg   = (iac: number) => iac >= 70 ? "#f0fdf4" : iac >= 40 ? "#fffbeb" : "#fff5f5";
const ROLE_LABEL: Record<TeamRole, string> = { owner: "Broker", team_leader: "Team Leader", member: "Agente" };
const ROLE_COLOR: Record<TeamRole, string> = { owner: RED, team_leader: "#7c3aed", member: "#16a34a" };

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const dayLabels = ["D", "L", "M", "X", "J", "V", "S"];
  // Generar labels de los últimos 7 días corridos, terminando hoy
  const today = new Date().getDay(); // 0=dom, 1=lun...
  const labels = Array.from({ length: 7 }, (_, i) => {
    const dayIdx = (today - 6 + i + 7) % 7;
    return dayLabels[dayIdx];
  });
  return (
    <div className="flex items-end gap-0.5 h-10">
      {data.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
          <div className="w-full rounded-sm transition-all"
            style={{ height: `${Math.max(2, (v / max) * 32)}px`, background: v > 0 ? color : "#e5e7eb", opacity: v === 0 ? 0.3 : 1 }} />
          <span className="text-gray-300" style={{ fontSize: 7, fontWeight: i === 6 ? 900 : 400 }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function TrendBadge({ trend, pct }: { trend: string; pct: number }) {
  if (trend === "up") return <span className="flex items-center gap-0.5 text-xs font-bold text-green-600"><TrendingUp size={10} />+{pct}%</span>;
  if (trend === "down") return <span className="flex items-center gap-0.5 text-xs font-bold text-red-500"><TrendingDown size={10} />{pct}%</span>;
  return <span className="flex items-center gap-0.5 text-xs text-gray-400"><Minus size={10} />estable</span>;
}

export default function BrokerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [overview, setOverview] = useState<TeamOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [requesterRole, setRequesterRole] = useState<TeamRole | null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [showTeamLeaders, setShowTeamLeaders] = useState(true);
  const [showBroker, setShowBroker] = useState(true);
  const [sortBy, setSortBy] = useState<"iac" | "trend" | "streak">("iac");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { if (status === "unauthenticated") router.replace("/login"); }, [status, router]);
  useEffect(() => { if (status === "authenticated") { loadTeam(); loadAnalytics(); } }, [status]);

  const loadTeam = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/teams/invite");
      if (res.status === 403) { router.replace("/"); return; }
      const data = await res.json();
      setRequesterRole(data.requesterRole);
      const agRes = await fetch("/api/teams/agency");
      if (agRes.ok) { const ag = await agRes.json(); setAgencyName(ag.agencyName || ""); }
      const stRes = await fetch("/api/teams/settings");
      if (stRes.ok) { const st = await stRes.json(); setShowTeamLeaders(st.showTeamLeaders ?? true); setShowBroker(st.showBroker ?? true); }
    } catch {}
    setLoading(false);
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch("/api/analytics/team");
      if (res.ok) { const data = await res.json(); setAgents(data.agents || []); setOverview(data.overview || null); }
    } catch {}
    setAnalyticsLoading(false);
  };

  const syncAll = async () => {
    setSyncing(true);
    try {
      await fetch("/api/teams/sync-all", { method: "POST" });
      await loadAnalytics();
    } catch {}
    setSyncing(false);
  };

  const isOwner = requesterRole === "owner";

  if (status === "loading" || loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 size={24} className="animate-spin" style={{ color: RED }} /></div>;
  }

  const filteredAgents = agents
    .filter(a => showTeamLeaders || a.teamRole !== "team_leader")
    .filter(a => showBroker || a.teamRole !== "owner");
  const needsAttention = filteredAgents.filter(a => a.status === "red");
  const onStreak = filteredAgents.filter(a => a.streak >= 3);
  const visibleAgents = agents
    .filter(a => showTeamLeaders || a.teamRole !== "team_leader")
    .filter(a => showBroker || a.teamRole !== "owner");
  const sortedAgents = [...visibleAgents].sort((a, b) => {
    if (sortBy === "iac") return b.iac - a.iac;
    if (sortBy === "trend") return b.trendPct - a.trendPct;
    if (sortBy === "streak") return b.streak - a.streak;
    return 0;
  });
  const teamIac = overview && overview.totalAgents > 0
    ? Math.round(overview.weekTotalMeetings / (overview.totalAgents * IAC_GOAL) * 100) : 0;
  const teamIacColor = iacColor(teamIac);
  const todayMeetings = agents.reduce((sum, a) => sum + (a.sparkline?.[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] ?? 0), 0);

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>{agencyName || "Mi Equipo"} — InmoCoach</title></Head>
      <div className="h-1 w-full" style={{ background: RED }} />

      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => router.push("/")} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={13} /> Volver
          </button>
          <div className="flex-1 text-center font-black text-lg tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
            {agencyName || "Mi Equipo"} · <span style={{ color: RED }}>InmoCoach</span>
          </div>
          {isOwner && (
            <button onClick={() => router.push("/cuenta")} className="text-xs font-semibold text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
              Gestionar →
            </button>
          )}
          <button onClick={syncAll} disabled={syncing}
            title="Sincronizar calendarios de todo el equipo"
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{syncing ? "Sincronizando..." : "Sync equipo"}</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6 space-y-5">

        {/* ── ALERTAS ── */}
        {agents.length > 0 && (needsAttention.length > 0 || onStreak.length > 0) && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl overflow-hidden border border-red-100" style={{ background: "#fff5f5" }}>
              <div className="px-5 py-3 flex items-center gap-2 border-b border-red-100">
                <AlertTriangle size={13} style={{ color: RED }} />
                <span className="text-xs font-black uppercase tracking-wide" style={{ color: RED }}>Necesitan atención</span>
                <span className="ml-auto text-xs font-black px-2 py-0.5 rounded-full bg-white" style={{ color: RED }}>{needsAttention.length}</span>
              </div>
              {needsAttention.length === 0 ? (
                <p className="px-5 py-4 text-xs text-gray-400">¡Todos por encima del 40% 🎉</p>
              ) : (
                <div className="divide-y divide-red-50">
                  {needsAttention.map(a => (
                    <button key={a.email} onClick={() => router.push(`/equipo/agente?email=${encodeURIComponent(a.email)}`)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-red-50 transition-colors text-left">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0" style={{ background: `${RED}20`, color: RED }}>
                        {(a.name || a.email)[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-800 truncate">{a.name || a.email}</div>
                        <div className="text-xs font-black mt-0.5" style={{ color: RED }}>IAC {a.iac}% · {a.weekTotal}/{IAC_GOAL} reuniones</div>
                      </div>
                      <ChevronRight size={13} className="text-red-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl overflow-hidden border border-orange-100" style={{ background: "#fff8f0" }}>
              <div className="px-5 py-3 flex items-center gap-2 border-b border-orange-100">
                <Flame size={13} className="text-orange-500" />
                <span className="text-xs font-black text-orange-700 uppercase tracking-wide">En racha</span>
                <span className="ml-auto text-xs font-black px-2 py-0.5 rounded-full bg-white text-orange-600">{onStreak.length}</span>
              </div>
              {onStreak.length === 0 ? (
                <p className="px-5 py-4 text-xs text-gray-400">Nadie con racha ≥ 3 días aún.</p>
              ) : (
                <div className="divide-y divide-orange-50">
                  {onStreak.sort((a, b) => b.streak - a.streak).map(a => (
                    <button key={a.email} onClick={() => router.push(`/equipo/agente?email=${encodeURIComponent(a.email)}`)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-orange-50 transition-colors text-left">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 bg-orange-100 text-orange-600">
                        {(a.name || a.email)[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-800 truncate">{a.name || a.email}</div>
                        <div className="text-xs font-black text-orange-600 mt-0.5">{a.streak >= 5 ? "🔥" : "⚡"} {a.streak} días consecutivos</div>
                      </div>
                      <ChevronRight size={13} className="text-orange-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── IAC DEL EQUIPO ── */}
        {overview && overview.totalAgents > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">IAC del equipo esta semana</div>
                <div className="flex items-end gap-3">
                  <span className="font-black leading-none" style={{ fontFamily: "Georgia, serif", fontSize: 64, color: teamIacColor }}>{teamIac}%</span>
                  <div className="mb-2">
                    <div className="text-sm font-black" style={{ color: teamIacColor }}>{iacLabel(teamIac)}</div>
                    <div className="text-xs text-gray-400">{overview.weekTotalMeetings} / {overview.totalAgents * IAC_GOAL} reuniones · {overview.totalAgents} agentes</div>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-1">Hoy en el equipo</div>
                <div className="font-black text-4xl text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{todayMeetings}</div>
                <div className="text-xs text-gray-400">reuniones cara a cara</div>
              </div>
            </div>
            <div className="px-6 mb-5">
              <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700 relative"
                  style={{ width: `${Math.min(teamIac, 100)}%`, background: teamIacColor }}>
                  {teamIac >= 15 && (
                    <span className="absolute right-2 top-0 bottom-0 flex items-center text-white font-black" style={{ fontSize: 9 }}>{teamIac}%</span>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 border-t border-gray-50">
              {[
                { label: "Total reuniones", value: overview.weekTotalMeetings, sub: `meta ${overview.totalAgents * IAC_GOAL}`, color: "#111827" },
                { label: "Productivos 🟢", value: overview.greenAgents, sub: "IAC ≥ 70%", color: "#16a34a" },
                { label: "En construcción 🟡", value: overview.yellowAgents, sub: "IAC 40–70%", color: "#d97706" },
                { label: "En riesgo 🔴", value: overview.redAgents, sub: "IAC < 40%", color: RED },
              ].map((s, i) => (
                <div key={i} className="px-4 py-4 border-r border-gray-50 last:border-0 text-center">
                  <div className="font-black text-3xl" style={{ fontFamily: "Georgia, serif", color: s.color }}>{s.value}</div>
                  <div className="text-xs text-gray-400 mt-1 leading-tight">{s.label}</div>
                  <div className="text-xs font-semibold mt-0.5" style={{ color: s.color }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RANKING ── */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
            <Users size={13} className="text-gray-400" />
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Ranking del equipo</span>
            <div className="ml-auto flex items-center gap-1.5">
              {(["iac", "trend", "streak"] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className="text-xs font-bold px-2.5 py-1 rounded-lg transition-all"
                  style={{ background: sortBy === s ? RED : "#f3f4f6", color: sortBy === s ? "white" : "#9ca3af" }}>
                  {s === "iac" ? "IAC" : s === "trend" ? "Tendencia" : "Racha"}
                </button>
              ))}
              <button onClick={syncAll} disabled={syncing} className="ml-1 text-gray-400 hover:text-gray-600 disabled:opacity-50">
                {syncing || analyticsLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              </button>
            </div>
          </div>

          {analyticsLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
          ) : agents.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-gray-400 mb-3">Todavía no tenés agentes activos.</p>
              <button onClick={() => router.push("/cuenta")}
                className="text-xs font-bold px-4 py-2 rounded-xl text-white hover:opacity-90"
                style={{ background: RED }}>Invitar agentes →</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sortedAgents.map((agent, idx) => {
                const color = iacColor(agent.iac);
                const bg = iacBg(agent.iac);
                return (
                  <div key={agent.email} className="px-5 py-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-7 text-center shrink-0">
                        <span className="text-sm font-black" style={{ color: idx === 0 ? "#d97706" : "#d1d5db" }}>
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                        </span>
                      </div>
                      {agent.avatar ? (
                        <img src={agent.avatar} alt="" className="w-12 h-12 rounded-full shrink-0 border-2" style={{ borderColor: color }} />
                      ) : (
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black shrink-0 border-2"
                          style={{ background: bg, color, borderColor: color }}>
                          {(agent.name || agent.email)[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-base font-black text-gray-900">{agent.name || agent.email}</span>
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: `${ROLE_COLOR[agent.teamRole]}15`, color: ROLE_COLOR[agent.teamRole] }}>
                            {ROLE_LABEL[agent.teamRole]}
                          </span>
                          {agent.streak >= 3 && (
                            <span className="text-xs font-black text-orange-500">{agent.streak >= 5 ? "🔥" : "⚡"} {agent.streak}d</span>
                          )}
                        </div>
                        {agent.name && <div className="text-xs text-gray-400 truncate">{agent.email}</div>}
                        <div className="mt-2.5 flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(agent.iac, 100)}%`, background: color }} />
                          </div>
                          <span className="text-xs font-black w-10 text-right shrink-0" style={{ color }}>{agent.iac}%</span>
                        </div>
                      </div>
                      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 min-w-[80px]">
                        <div className="text-2xl font-black leading-none" style={{ fontFamily: "Georgia, serif", color }}>
                          {agent.weekTotal}<span className="text-sm font-normal text-gray-300">/{IAC_GOAL}</span>
                        </div>
                        <div className="text-xs text-gray-400">esta semana</div>
                        <TrendBadge trend={agent.trend} pct={Math.abs(agent.trendPct)} />
                      </div>
                      <div className="hidden md:block shrink-0 w-24">
                        <div className="text-xs text-gray-400 mb-1">7 días</div>
                        <Sparkline data={agent.sparkline} color={color} />
                      </div>
                      <button onClick={() => router.push(`/equipo/agente?email=${encodeURIComponent(agent.email)}`)}
                        className="shrink-0 text-gray-300 hover:text-gray-600 transition-colors">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="sm:hidden mt-3 flex items-center justify-between ml-11 pl-4">
                      <div className="text-sm font-black" style={{ color }}>{agent.weekTotal}/{IAC_GOAL} reuniones</div>
                      <TrendBadge trend={agent.trend} pct={Math.abs(agent.trendPct)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
