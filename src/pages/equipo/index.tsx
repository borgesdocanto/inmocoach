import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import AppLayout from "../../components/AppLayout";
import {
  ArrowLeft, Loader2, Users,
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  ChevronRight, Flame, RefreshCw
} from "lucide-react";

const RED = "#aa0000";
// IAC_GOAL now comes from overview.weeklyGoal

type TeamRole = "owner" | "team_leader" | "member";

interface AgentSummary {
  email: string; name?: string; avatar?: string; teamRole: TeamRole;
  weekTotal: number; weekProductiveDays: number; iac: number; weeklyGoal: number;
  monthTotal: number; trend: "up" | "down" | "stable"; trendPct: number;
  status: "green" | "yellow" | "red"; sparkline: number[]; streak: number;
}
interface TeamOverview {
  totalAgents: number; weekTotalMeetings: number; weeklyGoal: number;
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

function InviteButton({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const handleInvite = async () => {
    setSending(true);
    const r = await fetch("/api/teams/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const d = await r.json();
    if (d.ok) setDone(true);
    else alert(d.error || "Error al invitar");
    setSending(false);
  };
  if (done) return <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 500 }}>✓ Invitado</span>;
  return (
    <button onClick={handleInvite} disabled={sending}
      style={{ background: sending ? "#e5e7eb" : RED, color: sending ? "#9ca3af" : "#fff", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 500, cursor: sending ? "default" : "pointer", flexShrink: 0 }}>
      {sending ? "Enviando..." : "Invitar a InmoCoach"}
    </button>
  );
}

export default function BrokerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [overview, setOverview] = useState<TeamOverview | null>(null);
  const [portfolio, setPortfolio] = useState<{ connected: boolean; active: any[]; uninvited: any[] } | null>(null);
  const [portfolioOpen, setPortfolioOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [requesterRole, setRequesterRole] = useState<TeamRole | null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [showTeamLeaders, setShowTeamLeaders] = useState(true);
  const [showBroker, setShowBroker] = useState(true);
  const [sortBy, setSortBy] = useState<"iac" | "trend" | "streak">("iac");
  const [syncing, setSyncing] = useState(false);
  const [syncErrors, setSyncErrors] = useState<{email: string; status: string}[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => { if (status === "unauthenticated") router.replace("/login"); }, [status, router]);

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
      // Load portfolio
      fetch("/api/analytics/team-portfolio")
        .then(r => { console.log("[portfolio] status:", r.status); return r.ok ? r.json() : r.json().then(e => { console.error("[portfolio] error:", e); return null; }); })
        .then(d => { console.log("[portfolio] data:", JSON.stringify(d)); if (d) setPortfolio(d); })
        .catch(e => console.error("[portfolio] fetch error:", e));
    } catch {}
    setLoading(false);
  };

  const loadAnalytics = async (offset = weekOffset) => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/analytics/team?weekOffset=${offset}`);
      if (res.ok) { const data = await res.json(); setAgents(data.agents || []); setOverview(data.overview || null); }
    } catch {}
    setAnalyticsLoading(false);
  };

  useEffect(() => { if (status === "authenticated") { loadTeam(); loadAnalytics(0); } }, [status]);
  useEffect(() => { if (status === "authenticated") loadAnalytics(weekOffset); }, [weekOffset]);

  const syncAll = async () => {
    setSyncing(true);
    setSyncErrors([]);
    try {
      const res = await fetch("/api/teams/sync-all", { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        if (d.errors?.length) setSyncErrors(d.errors);
      }
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
    ? Math.round(overview.weekTotalMeetings / (overview.totalAgents * (overview.weeklyGoal ?? 15)) * 100) : 0;
  const teamIacColor = iacColor(teamIac);
  const todayMeetings = agents.reduce((sum, a) => sum + (a.sparkline?.[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] ?? 0), 0);

  return (
    <AppLayout greeting={agencyName || "Mi Equipo"} topbarExtra={
      <button onClick={syncAll} disabled={syncing} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: syncing ? "#d97706" : "#6b7280", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}>
        <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Sincronizando..." : "Sync equipo"}
      </button>
    }>
      <Head><title>{agencyName || "Mi Equipo"} — InmoCoach</title></Head>

      <style>{`
        .eq-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .eq-alerts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 900px) { .eq-kpis { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .eq-alerts { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ padding: "24px 24px 60px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 500, color: "#111827", fontFamily: "Georgia, serif" }}>
                {agencyName || "Mi Equipo"}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Dashboard del equipo</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {isOwner && (
                <button onClick={() => router.push("/cuenta")}
                  style={{ fontSize: 12, color: "#6b7280", background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>
                  Gestionar equipo →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sync errors */}
        {syncErrors.length > 0 && (
          <div style={{ background: "#FFFBEB", border: "0.5px solid #fcd34d", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#92400e", marginBottom: 8 }}>
                {syncErrors.length} agente{syncErrors.length !== 1 ? "s" : ""} sin conexión a Google Calendar
              </div>
              {syncErrors.map((e, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#b45309" }}>
                    <strong>{e.email.split("@")[0]}</strong> — {e.status === "no_token" ? "nunca reconectó" : "error al sincronizar"}
                  </span>
                  <button onClick={async () => {
                      await fetch("/api/admin/ops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke_google_token", email: e.email }) });
                      setSyncErrors(prev => prev.filter(x => x.email !== e.email));
                    }}
                    style={{ fontSize: 11, color: "#92400e", background: "#fef3c7", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", marginLeft: 8, flexShrink: 0 }}>
                    Forzar reconexión
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setSyncErrors([])} style={{ background: "none", border: "none", color: "#d97706", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>×</button>
          </div>
        )}

        {/* KPIs del equipo */}
        {overview && overview.totalAgents > 0 && (
          <div className="eq-kpis" style={{ marginBottom: 16 }}>
            {[
              { label: "IAC equipo", value: `${teamIac}%`, color: teamIacColor, sub: `${overview.weekTotalMeetings} / ${overview.totalAgents * (overview.weeklyGoal ?? 15)} reuniones` },
              { label: "En objetivo 🟢", value: overview.greenAgents, color: "#16a34a", sub: "IAC ≥ 70%" },
              { label: "En construcción 🟡", value: overview.yellowAgents, color: "#d97706", sub: "IAC 40–70%" },
              { label: "En riesgo 🔴", value: overview.redAgents, color: RED, sub: "IAC < 40%" },
            ].map(k => (
              <div key={k.label} style={{ background: "#fff", border: `0.5px solid ${k.color}20`, borderTop: `3px solid ${k.color}`, borderRadius: "0 0 12px 12px", padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{k.label}</div>
                <div style={{ fontSize: 36, fontWeight: 500, fontFamily: "Georgia, serif", color: k.color, lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>{k.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Alertas rápidas */}
        {agents.length > 0 && (needsAttention.length > 0 || onStreak.length > 0) && (
          <div className="eq-alerts" style={{ marginBottom: 16 }}>
            <div style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #fecaca", display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2" }}>
                <AlertTriangle size={13} style={{ color: RED, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: RED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Necesitan atención</span>
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, background: "#fff", color: RED, borderRadius: 10, padding: "1px 7px" }}>{needsAttention.length}</span>
              </div>
              {needsAttention.length === 0
                ? <div style={{ padding: "16px", fontSize: 12, color: "#9ca3af" }}>¡Todos por encima del 40% 🎉</div>
                : needsAttention.map(a => (
                  <button key={a.email} onClick={() => router.push(`/equipo/agente?email=${encodeURIComponent(a.email)}`)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "0.5px solid #f9fafb", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${RED}15`, color: RED, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                      {(a.name || a.email)[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name || a.email}</div>
                      <div style={{ fontSize: 11, color: RED, marginTop: 2 }}>IAC {a.iac}% · {a.weekTotal}/{a.weeklyGoal ?? 15} reuniones</div>
                    </div>
                    <ChevronRight size={13} style={{ color: "#fca5a5", flexShrink: 0 }} />
                  </button>
                ))
              }
            </div>

            <div style={{ background: "#fff", border: "0.5px solid #fed7aa", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #fed7aa", display: "flex", alignItems: "center", gap: 8, background: "#FFF7ED" }}>
                <Flame size={13} style={{ color: "#ea580c", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.06em" }}>En racha</span>
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, background: "#fff", color: "#ea580c", borderRadius: 10, padding: "1px 7px" }}>{onStreak.length}</span>
              </div>
              {onStreak.length === 0
                ? <div style={{ padding: "16px", fontSize: 12, color: "#9ca3af" }}>Nadie con racha ≥ 3 días aún.</div>
                : [...onStreak].sort((a, b) => b.streak - a.streak).map(a => (
                  <button key={a.email} onClick={() => router.push(`/equipo/agente?email=${encodeURIComponent(a.email)}`)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "0.5px solid #fff7ed", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#FFF7ED", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                      {(a.name || a.email)[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name || a.email}</div>
                      <div style={{ fontSize: 11, color: "#ea580c", marginTop: 2 }}>{a.streak >= 5 ? "🔥" : "⚡"} {a.streak} días consecutivos</div>
                    </div>
                    <ChevronRight size={13} style={{ color: "#fdba74", flexShrink: 0 }} />
                  </button>
                ))
              }
            </div>
          </div>
        )}

        {/* Ranking */}
        <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Users size={13} style={{ color: "#9ca3af" }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>Ranking del equipo</span>

            {/* Week nav */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: "3px 8px" }}>
              <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>‹</button>
              <span style={{ fontSize: 11, color: "#374151", minWidth: 90, textAlign: "center" }}>
                {weekOffset === 0 ? "Esta semana" : (() => {
                  const mon = new Date(); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) + weekOffset * 7); mon.setHours(0,0,0,0);
                  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                  return `${mon.getDate()} – ${sun.getDate()} ${sun.toLocaleDateString("es-AR", { month: "short" })}`;
                })()}
              </span>
              <button onClick={() => setWeekOffset(w => Math.min(0, w + 1))} disabled={weekOffset === 0} style={{ background: "none", border: "none", color: weekOffset === 0 ? "#d1d5db" : "#9ca3af", cursor: weekOffset === 0 ? "default" : "pointer", fontSize: 14, lineHeight: 1 }}>›</button>
            </div>

            {/* Sort */}
            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              {(["iac", "trend", "streak"] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)} style={{ fontSize: 11, fontWeight: 500, background: sortBy === s ? "#111827" : "#f3f4f6", color: sortBy === s ? "#fff" : "#9ca3af", border: "none", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>
                  {s === "iac" ? "IAC" : s === "trend" ? "Tendencia" : "Racha"}
                </button>
              ))}
            </div>
          </div>

          {analyticsLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0" }}>
              <Loader2 size={20} style={{ color: "#d1d5db" }} className="animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <div style={{ padding: "48px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>Todavía no tenés agentes activos.</div>
              <button onClick={() => router.push("/cuenta")} style={{ background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                Invitar agentes →
              </button>
            </div>
          ) : (
            <div>
              {sortedAgents.map((agent, idx) => {
                const color = iacColor(agent.iac);
                const bg = iacBg(agent.iac);
                return (
                  <div key={agent.email} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "0.5px solid #f9fafb", cursor: "pointer" }}
                    onClick={() => router.push(`/equipo/agente?email=${encodeURIComponent(agent.email)}`)}>
                    {/* Posición */}
                    <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: idx < 3 ? 18 : 12, color: "#d1d5db", fontWeight: 500 }}>
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                      </span>
                    </div>

                    {/* Avatar */}
                    {agent.avatar
                      ? <img src={agent.avatar} alt="" style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, border: `2px solid ${color}` }} />
                      : <div style={{ width: 44, height: 44, borderRadius: "50%", background: bg, color, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 500, flexShrink: 0 }}>
                          {(agent.name || agent.email)[0].toUpperCase()}
                        </div>
                    }

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{agent.name || agent.email}</span>
                        <span style={{ fontSize: 10, fontWeight: 500, padding: "1px 6px", borderRadius: 5, background: `${ROLE_COLOR[agent.teamRole]}15`, color: ROLE_COLOR[agent.teamRole] }}>
                          {ROLE_LABEL[agent.teamRole]}
                        </span>
                        {agent.streak >= 3 && (
                          <span style={{ fontSize: 11, color: "#ea580c" }}>{agent.streak >= 5 ? "🔥" : "⚡"} {agent.streak}d</span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: color, borderRadius: 2, width: `${Math.min(agent.iac, 100)}%` }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color, minWidth: 36, textAlign: "right" }}>{agent.iac}%</span>
                      </div>
                    </div>

                    {/* Métrica según sort */}
                    <div style={{ textAlign: "right", minWidth: 70, flexShrink: 0 }}>
                      {sortBy === "iac" && (
                        <>
                          <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "Georgia, serif", color, lineHeight: 1 }}>
                            {agent.weekTotal}<span style={{ fontSize: 12, color: "#d1d5db" }}>/{agent.weeklyGoal ?? 15}</span>
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>esta semana</div>
                        </>
                      )}
                      {sortBy === "trend" && (
                        <TrendBadge trend={agent.trend} pct={Math.abs(agent.trendPct)} />
                      )}
                      {sortBy === "streak" && (
                        <>
                          <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "Georgia, serif", color: "#ea580c", lineHeight: 1 }}>
                            {agent.streak}<span style={{ fontSize: 12, color: "#d1d5db" }}>d</span>
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>racha</div>
                        </>
                      )}
                    </div>

                    {/* Sparkline */}
                    <div style={{ flexShrink: 0 }}>
                      <Sparkline data={agent.sparkline} color={color} />
                    </div>

                    <ChevronRight size={14} style={{ color: "#d1d5db", flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── CARTERA TOKKO POR AGENTE ── */}
        {portfolio?.connected && (
          <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginTop: 12 }}>
            <button onClick={() => setPortfolioOpen(o => !o)}
              style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
              <span style={{ fontSize: 16 }}>🏠</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>Cartera Tokko por agente</span>
              <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>
                {[...portfolio.active, ...portfolio.uninvited].reduce((s: number, a: any) => s + a.total, 0)} propiedades
              </span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>{portfolioOpen ? "▲" : "▼"}</span>
            </button>

            {portfolioOpen && (
              <div style={{ borderTop: "0.5px solid #f3f4f6" }}>

                {/* Agentes activos del equipo */}
                {portfolio.active.length > 0 && (
                  <>
                    {/* Header */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 72px 72px 72px", gap: 8, padding: "8px 16px", background: "#f9fafb", borderBottom: "0.5px solid #f3f4f6" }}>
                      {["Agente", "Total", "Fichas OK", "Mejorar", "+30d"].map((h, i) => (
                        <div key={h} style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", textAlign: i > 0 ? "center" : "left" }}>{h}</div>
                      ))}
                    </div>
                    {portfolio.active.map((agent: any, i: number) => {
                      const pct = agent.total > 0 ? Math.round((agent.complete / agent.total) * 100) : 0;
                      const health = pct === 100 ? "#16a34a" : pct >= 70 ? "#d97706" : "#dc2626";
                      return (
                        <div key={agent.email}
                          onClick={() => router.push(`/cartera?agentEmail=${encodeURIComponent(agent.email)}&agentName=${encodeURIComponent(agent.name)}`)}
                          style={{ display: "grid", gridTemplateColumns: "1fr 72px 72px 72px 72px", gap: 8, padding: "11px 16px", borderBottom: i < portfolio.active.length - 1 ? "0.5px solid #f9fafb" : "none", alignItems: "center", cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {agent.avatar
                              ? <img src={agent.avatar} style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
                              : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, color: "#9ca3af", flexShrink: 0 }}>{agent.name[0]}</div>}
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{agent.name}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                <div style={{ width: 48, height: 3, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
                                  <div style={{ height: "100%", background: health, borderRadius: 2, width: `${pct}%` }} />
                                </div>
                                <span style={{ fontSize: 10, color: health, fontWeight: 500 }}>{pct}%</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: "center", fontSize: 14, fontWeight: 500, color: "#374151" }}>{agent.total}</div>
                          <div style={{ textAlign: "center", fontSize: 14, fontWeight: 500, color: "#16a34a" }}>{agent.complete}</div>
                          <div style={{ textAlign: "center" }}>
                            {agent.incomplete > 0
                              ? <span style={{ fontSize: 12, fontWeight: 500, color: "#dc2626", background: "#FEF2F2", borderRadius: 5, padding: "1px 7px" }}>{agent.incomplete}</span>
                              : <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>}
                          </div>
                          <div style={{ textAlign: "center" }}>
                            {agent.stale > 0
                              ? <span style={{ fontSize: 12, fontWeight: 500, color: "#d97706", background: "#FFFBEB", borderRadius: 5, padding: "1px 7px" }}>{agent.stale}</span>
                              : <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Agentes Tokko no invitados */}
                {portfolio.uninvited.length > 0 && (
                  <>
                    <div style={{ padding: "8px 16px", background: "#f9fafb", borderTop: portfolio.active.length > 0 ? "0.5px solid #f3f4f6" : "none", borderBottom: "0.5px solid #f3f4f6" }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: "#374151" }}>Agentes en Tokko sin invitar</span>
                    </div>
                    {portfolio.uninvited.map((agent: any, i: number) => (
                      <div key={agent.email} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: i < portfolio.uninvited.length - 1 ? "0.5px solid #f9fafb" : "none" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, color: "#9ca3af", flexShrink: 0 }}>
                          {agent.name[0]}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{agent.name}</span>
                          <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>{agent.total} propiedad{agent.total !== 1 ? "es" : ""}</span>
                        </div>
                        <InviteButton email={agent.email} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {portfolio && !portfolio.connected && isOwner && (
          <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: "16px 20px", marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>🏠</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>Conectá Tokko para ver la cartera del equipo</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Fichas, actualizaciones y estado por agente</div>
            </div>
            <button onClick={() => router.push("/tokko-setup")}
              style={{ background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>
              Conectar →
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
