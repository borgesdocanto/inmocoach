import { GetServerSideProps } from "next";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { requireSuperAdmin } from "../../lib/adminGuard";
import {
  Users, CreditCard, BarChart2, Zap, Search, RefreshCw, Settings,
  ChevronDown, CheckCircle, XCircle, Clock, Loader2,
  Calendar, Mail, Shield, TrendingUp, AlertTriangle, Target
} from "lucide-react";

const RED = "#aa0000";

const PLAN_COLOR: Record<string, string> = {
  free: "#6b7280", individual: "#7c3aed", teams: "#16a34a"
};
const PLAN_BG: Record<string, string> = {
  free: "#f3f4f6", individual: "#f5f3ff", teams: "#f0fdf4"
};
const PLAN_LABEL: Record<string, string> = {
  free: "Free", individual: "Individual", teams: "Teams"
};

interface AdminStats {
  totals: { users: number; paid: number; free: number; withCalendar: number; newLast7: number; newLast30: number; conversionRate: number };
  byPlan: { free: number; individual: number; teams: number };
  teams: { id: string; name: string; agency_name?: string; owner_email: string; ownerName: string; memberCount: number; created_at: string; status: string }[];
  recentPayments: { amount: number; created_at: string; status: string }[];
}

interface AdminUser {
  email: string; name?: string; avatar?: string; plan: string; status: string;
  teamRole?: string; hasCalendar: boolean; createdAt: string; daysSince: number;
  freemiumExpired: boolean; freemiumDaysLeft: number | null;
}

export default function AdminPanel() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tab, setTab] = useState<"overview" | "users" | "teams" | "ops" | "precios" | "eventos" | "goals">("overview");
  const [goalsConfig, setGoalsConfig] = useState({ weekly_goal: "15", productive_day_min: "2" });
  const [goalsSaving, setGoalsSaving] = useState(false);
  const [goalsMsg, setGoalsMsg] = useState("");
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [eventTypesSaving, setEventTypesSaving] = useState(false);
  const [etForm, setEtForm] = useState<any | null>(null); // null = closed, {} = new, {...} = editing
  const EMPTY_ET = { event_type: "", label: "", keywords: "", is_green: false, is_proceso: false, is_cierre: false, is_custom: true };
  const [eventTypesLoading, setEventTypesLoading] = useState(false);
  const [planFilter, setPlanFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<Record<string, string>>({});
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsMsg, setOpsMsg] = useState("");
  const [emailTemplate, setEmailTemplate] = useState<"welcome" | "weekly">("welcome");
  const [emailRecipient, setEmailRecipient] = useState<"all" | "specific">("specific");
  const [emailSearch, setEmailSearch] = useState("");
  const [emailSearchResults, setEmailSearchResults] = useState<{email:string;name?:string}[]>([]);
  const [emailSelected, setEmailSelected] = useState<string[]>([]);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{sent:number;failed:number;total:number;errors:string[]} | null>(null);
  const [emailPreview, setEmailPreview] = useState<"welcome"|"weekly"|null>(null);
  const [plans, setPlans] = useState<Record<string, any>>({});
  const [plansLoading, setPlansLoading] = useState(false);
  const [planInputs, setPlanInputs] = useState<Record<string, string>>({});
  const [planSaving, setPlanSaving] = useState<string | null>(null);
  const [planMsg, setPlanMsg] = useState<Record<string, string>>({});
  const [teamSearch, setTeamSearch] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<AdminStats["teams"][0] | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [suspendConfirm, setSuspendConfirm] = useState(false);
  const [suspendLoading, setSuspendLoading] = useState(false);
  const [suspendMsg, setSuspendMsg] = useState("");

  useEffect(() => { loadStats(); }, []);
  useEffect(() => { if (tab === "users" || tab === "teams") loadUsers(); }, [tab, planFilter, search]);
  useEffect(() => { if (tab === "precios") loadPlans(); }, [tab]);
  useEffect(() => {
    if (tab === "eventos") {
      setEventTypesLoading(true);
      fetch("/api/admin/event-types")
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setEventTypes(d); })
        .catch(console.error)
        .finally(() => setEventTypesLoading(false));
    }
  }, [tab]);
  useEffect(() => {
    if (tab === "goals") {
      fetch("/api/admin/config")
        .then(r => r.json())
        .then(d => setGoalsConfig(prev => ({ ...prev, ...d })))
        .catch(console.error);
    }
  }, [tab]);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      setStats(data);
    } catch { }
    setLoadingStats(false);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (planFilter !== "all") params.set("plan", planFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch { }
    setLoadingUsers(false);
  };

  const loadPlans = async () => {
    setPlansLoading(true);
    try {
      const r = await fetch("/api/admin/plans");
      const d = await r.json();
      setPlans(d);
      const inputs: Record<string, string> = {};
      for (const [id, p] of Object.entries(d) as any) {
        if (p.amount) inputs[id] = String(p.amount);
      }
      setPlanInputs(inputs);
    } catch {}
    setPlansLoading(false);
  };

  const searchEmailUsers = async (q: string) => {
    if (!q) { setEmailSearchResults([]); return; }
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}&limit=8`);
      const data = await res.json();
      setEmailSearchResults((data.users || []).map((u: any) => ({ email: u.email, name: u.name })));
    } catch {}
  };

  const sendEmails = async () => {
    const recipients = emailRecipient === "all" ? "all" : emailSelected;
    if (recipients !== "all" && (recipients as string[]).length === 0) { setOpsMsg("Seleccioná al menos un destinatario"); return; }
    setEmailSending(true); setEmailResult(null); setOpsMsg("");
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: emailTemplate, recipients }),
      });
      const data = await res.json();
      setEmailResult(data);
    } catch { setOpsMsg("Error de conexión"); }
    setEmailSending(false);
  };

  const updateDiscountOnly = async (planId: string) => {
    const amount = planInputs[planId];
    if (!amount || isNaN(Number(amount))) return;
    setPlanSaving(planId);
    setPlanMsg(prev => ({ ...prev, [planId]: "" }));
    try {
      const r = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, amount: Number(amount), supabaseOnly: true }),
      });
      const d = await r.json();
      if (d.ok) {
        setPlanMsg(prev => ({ ...prev, [planId]: `✓ Descuento actualizado a ${Number(amount)}%` }));
        loadPlans();
      } else {
        setPlanMsg(prev => ({ ...prev, [planId]: d.error || "Error" }));
      }
    } catch {
      setPlanMsg(prev => ({ ...prev, [planId]: "Error de conexión" }));
    }
    setPlanSaving(null);
  };

  const updatePlanPrice = async (planId: string) => {
    const amount = planInputs[planId];
    if (!amount || isNaN(Number(amount))) return;
    setPlanSaving(planId);
    setPlanMsg(prev => ({ ...prev, [planId]: "" }));
    try {
      const r = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, amount: Number(amount) }),
      });
      const d = await r.json();
      if (d.ok) {
        setPlanMsg(prev => ({ ...prev, [planId]: `✓ Actualizado a $ ${Number(d.newAmount).toLocaleString("es-AR")}` }));
        loadPlans();
      } else {
        setPlanMsg(prev => ({ ...prev, [planId]: d.error || "Error" }));
      }
    } catch {
      setPlanMsg(prev => ({ ...prev, [planId]: "Error de conexion" }));
    }
    setPlanSaving(null);
  };

  const userAction = async (email: string, action: string, extra?: any) => {
    setActionLoading(`${email}-${action}`);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email, ...extra }),
      });
      const data = await res.json();
      setActionMsg(prev => ({ ...prev, [email]: data.ok ? "✓ Listo" : (data.error || "Error") }));
      if (data.ok) { setTimeout(() => { setActionMsg(prev => { const n = {...prev}; delete n[email]; return n; }); loadUsers(); }, 2000); }
    } catch { setActionMsg(prev => ({ ...prev, [email]: "Error" })); }
    setActionLoading(null);
  };

  const triggerOp = async (action: string, email?: string) => {
    setOpsLoading(true); setOpsMsg("");
    try {
      const res = await fetch("/api/admin/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email }),
      });
      const data = await res.json();
      setOpsMsg(data.ok ? `✓ ${action} ejecutado` : (data.error || "Error"));
    } catch { setOpsMsg("Error de conexión"); }
    setOpsLoading(false);
  };

  const loadTeamMembers = async (teamId: string) => {
    setTeamMembersLoading(true);
    setTeamMembers([]);
    try {
      const res = await fetch(`/api/admin/teams?teamId=${teamId}`);
      const data = await res.json();
      setTeamMembers(data.members || []);
    } catch {}
    setTeamMembersLoading(false);
  };

  const suspendTeam = async (teamId: string) => {
    setSuspendLoading(true);
    setSuspendMsg("");
    try {
      const res = await fetch("/api/admin/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suspend_team", teamId }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuspendMsg("✓ Equipo suspendido");
        setSuspendConfirm(false);
        setTimeout(() => setSuspendMsg(""), 3000);
        loadStats();
      } else {
        setSuspendMsg(data.error || "Error");
      }
    } catch {
      setSuspendMsg("Error de conexión");
    }
    setSuspendLoading(false);
  };

  const reactivateTeam = async (teamId: string) => {
    setSuspendLoading(true);
    setSuspendMsg("");
    try {
      const res = await fetch("/api/admin/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate_team", teamId }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuspendMsg("✓ Equipo reactivado");
        setSuspendConfirm(false);
        setTimeout(() => setSuspendMsg(""), 3000);
        loadStats();
        loadTeamMembers(teamId);
      } else {
        setSuspendMsg(data.error || "Error");
      }
    } catch {
      setSuspendMsg("Error de conexión");
    }
    setSuspendLoading(false);
  };

  const ROLE_LABEL: Record<string, string> = {
    owner: "Broker",
    team_leader: "Team Leader",
    member: "Agente",
  };
  const ROLE_COLOR: Record<string, string> = {
    owner: RED,
    team_leader: "#7c3aed",
    member: "#6b7280",
  };
  const ROLE_BG: Record<string, string> = {
    owner: "#fff5f5",
    team_leader: "#f5f3ff",
    member: "#f3f4f6",
  };

  const KPI = ({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) => (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-3xl font-black" style={{ fontFamily: "Georgia, serif", color: color || "#111827" }}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );

  const saveEventTypes = async () => {
    setEventTypesSaving(true);
    await fetch("/api/admin/event-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configs: eventTypes }),
    });
    setEventTypesSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>Admin — InmoCoach</title></Head>
      <div className="h-0.5 w-full" style={{ background: RED }} />

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-4">
          <div className="font-black text-lg mr-auto" style={{ fontFamily: "Georgia, serif" }}>
            Inmo<span style={{ color: RED }}>Coach</span>
            <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 align-middle">ADMIN</span>
          </div>
          <button onClick={() => router.push("/")}
            className="text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors">
            ← Dashboard
          </button>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-5 flex gap-1 pb-0">
          {([
            { key: "overview", label: "Overview", icon: <BarChart2 size={13} /> },
            { key: "users", label: "Usuarios", icon: <Users size={13} /> },
            { key: "teams", label: "Equipos", icon: <Shield size={13} /> },
            { key: "ops", label: "Operaciones", icon: <Zap size={13} /> },
            { key: "precios", label: "Precios", icon: <CreditCard size={13} /> },
            { key: "eventos", label: "Tipos de evento", icon: <Settings size={13} /> },
            { key: "goals", label: "Goals", icon: <Target size={13} /> },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors"
              style={{ borderColor: tab === t.key ? RED : "transparent", color: tab === t.key ? RED : "#9ca3af" }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8 space-y-5">

        {/* OVERVIEW */}
        {tab === "overview" && (
          <>
            {loadingStats ? (
              <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
            ) : stats && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KPI label="Usuarios totales" value={stats.totals.users} sub={`+${stats.totals.newLast7} esta semana`} />
                  <KPI label="Pagos activos" value={stats.totals.paid} sub={`${stats.totals.conversionRate}% conversión`} color="#16a34a" />
                  <KPI label="Free / Trial" value={stats.totals.free} />
                  <KPI label="Con calendario" value={stats.totals.withCalendar} sub="Google Calendar conectado" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Free", value: stats.byPlan.free, color: PLAN_COLOR.free },
                    { label: "Individual", value: stats.byPlan.individual, color: PLAN_COLOR.individual },
                    { label: "Teams", value: stats.byPlan.teams, color: PLAN_COLOR.teams },
                  ].map((p, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />
                      <div>
                        <div className="text-xs text-gray-400">{p.label}</div>
                        <div className="text-2xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{p.value}</div>
                      </div>
                      <div className="ml-auto text-sm font-bold text-gray-300">
                        {stats.totals.users > 0 ? Math.round((p.value / stats.totals.users) * 100) : 0}%
                      </div>
                    </div>
                  ))}
                </div>

                {/* Equipos resumen */}
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                    <Shield size={13} className="text-gray-400" />
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Equipos activos</span>
                    <span className="ml-auto text-xs text-gray-400">{stats.teams.length} equipos</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {stats.teams.slice(0, 8).map(t => (
                      <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800">{t.agency_name || t.name}</div>
                          <div className="text-xs text-gray-400">{t.ownerName} · {t.owner_email}</div>
                        </div>
                        <div className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                          {t.memberCount} agente{t.memberCount !== 1 ? "s" : ""}
                        </div>
                      </div>
                    ))}
                    {stats.teams.length === 0 && (
                      <div className="px-5 py-6 text-center text-sm text-gray-400">Sin equipos todavía</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* USUARIOS */}
        {tab === "users" && (
          <>
            {/* Filtros */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-48">
                <Search size={13} className="text-gray-400 shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && loadUsers()}
                  placeholder="Buscar por email..."
                  className="flex-1 text-sm text-gray-700 outline-none bg-transparent" />
              </div>
              <div className="flex gap-2">
                {["all", "free", "individual", "teams"].map(p => (
                  <button key={p} onClick={() => setPlanFilter(p)}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
                    style={{ background: planFilter === p ? RED : "#f3f4f6", color: planFilter === p ? "#fff" : "#6b7280" }}>
                    {p === "all" ? "Todos" : PLAN_LABEL[p]}
                  </button>
                ))}
              </div>
              <button onClick={loadUsers} className="text-xs font-semibold text-gray-400 hover:text-gray-700 flex items-center gap-1">
                <RefreshCw size={11} /> Actualizar
              </button>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">{users.length} usuarios</span>
              </div>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {users.map(u => (
                    <div key={u.email} className="px-5 py-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-8 h-8 rounded-full shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-400 shrink-0">
                            {(u.name || u.email)[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-800">{u.name || u.email}</span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                              style={{ background: PLAN_BG[u.plan], color: PLAN_COLOR[u.plan] }}>
                              {PLAN_LABEL[u.plan] || u.plan}
                            </span>
                            {u.status === "cancelled" && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-red-50 text-red-400">Cancelado</span>
                            )}
                            {u.freemiumExpired && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-500">Trial expirado</span>
                            )}
                            {u.plan === "free" && !u.freemiumExpired && u.freemiumDaysLeft !== null && (
                              <span className="text-xs text-gray-400">{u.freemiumDaysLeft}d restantes</span>
                            )}
                            {u.hasCalendar && <Calendar size={11} className="text-green-500" />}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{u.email} · hace {u.daysSince}d</div>
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          {actionMsg[u.email] && (
                            <span className="text-xs font-semibold text-green-600">{actionMsg[u.email]}</span>
                          )}
                          {/* Cambiar plan */}
                          <select onChange={e => e.target.value && userAction(u.email, "change_plan", { plan: e.target.value })}
                            value=""
                            className="text-xs font-semibold text-gray-500 bg-gray-100 border-0 rounded-lg px-2 py-1.5 cursor-pointer focus:outline-none appearance-none">
                            <option value="" disabled>Cambiar plan</option>
                            <option value="free">→ Free</option>
                            <option value="individual">→ Individual</option>
                            <option value="teams">→ Teams</option>
                          </select>
                          {/* Extender trial */}
                          {u.plan === "free" && (
                            <button onClick={() => userAction(u.email, "extend_trial", { daysExtension: 7 })}
                              disabled={actionLoading === `${u.email}-extend_trial`}
                              className="text-xs font-semibold text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                              {actionLoading === `${u.email}-extend_trial` ? <Loader2 size={10} className="animate-spin" /> : <Clock size={10} />}
                              +7 días
                            </button>
                          )}
                          {/* Activar/desactivar */}
                          {u.status === "active" ? (
                            <button onClick={() => userAction(u.email, "deactivate")}
                              disabled={actionLoading === `${u.email}-deactivate`}
                              className="text-xs font-semibold text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors">
                              Desactivar
                            </button>
                          ) : (
                            <button onClick={() => userAction(u.email, "reactivate")}
                              disabled={actionLoading === `${u.email}-reactivate`}
                              className="text-xs font-semibold text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg transition-colors">
                              Reactivar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && !loadingUsers && (
                    <div className="px-5 py-8 text-center text-sm text-gray-400">Sin usuarios para los filtros seleccionados</div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* EQUIPOS */}
        {tab === "teams" && (
          <div className="flex gap-5" style={{ alignItems: "flex-start" }}>

            {/* Lista de equipos */}
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden" style={{ width: selectedTeam ? "340px" : "100%", flexShrink: 0, transition: "width 0.2s" }}>
              {/* Search */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Search size={13} className="text-gray-300 shrink-0" />
                <input
                  value={teamSearch}
                  onChange={e => setTeamSearch(e.target.value)}
                  placeholder="Buscar equipo o broker..."
                  className="flex-1 text-sm text-gray-700 outline-none bg-transparent"
                />
                <span className="text-xs font-bold text-gray-300 shrink-0">
                  {(stats?.teams || []).filter(t =>
                    !teamSearch || [t.agency_name, t.name, t.owner_email, t.ownerName].some(v => v?.toLowerCase().includes(teamSearch.toLowerCase()))
                  ).length}
                </span>
              </div>

              <div className="divide-y divide-gray-50" style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
                {(stats?.teams || [])
                  .filter(t => !teamSearch || [t.agency_name, t.name, t.owner_email, t.ownerName].some(v => v?.toLowerCase().includes(teamSearch.toLowerCase())))
                  .map(t => {
                    const isSelected = selectedTeam?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          if (isSelected) { setSelectedTeam(null); setTeamMembers([]); }
                          else { setSelectedTeam(t); loadTeamMembers(t.id); }
                        }}
                        className="px-4 py-3.5 cursor-pointer transition-colors"
                        style={{ background: isSelected ? "#fff5f5" : undefined }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#fafafa"; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = ""; }}
                      >
                        <div className="flex items-start gap-3">
                          {/* Avatar inicial */}
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                            style={{ background: isSelected ? RED : "#e5e7eb", color: isSelected ? "white" : "#9ca3af" }}>
                            {(t.agency_name || t.name || "?")[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-gray-900 truncate" style={{ color: isSelected ? RED : undefined }}>
                                {t.agency_name || t.name}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 truncate">{t.ownerName} · {t.owner_email}</div>
                          </div>
                          <span className="text-xs font-bold text-gray-400 shrink-0">{t.memberCount}</span>
                        </div>
                      </div>
                    );
                  })}
                {(!stats?.teams.length) && (
                  <div className="px-5 py-10 text-center text-sm text-gray-400">Sin equipos todavía</div>
                )}
              </div>
            </div>

            {/* Detalle del equipo seleccionado */}
            {selectedTeam && (
              <div className="flex-1 min-w-0 space-y-3">

                {/* Header del equipo */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>
                        {selectedTeam.agency_name || selectedTeam.name}
                      </div>
                      {selectedTeam.agency_name && (
                        <div className="text-xs text-gray-400 mt-0.5">{selectedTeam.name}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        Creado {new Date(selectedTeam.created_at).toLocaleDateString("es-AR")} ·{" "}
                        <span className="font-semibold text-gray-600">{selectedTeam.memberCount} miembro{selectedTeam.memberCount !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 items-center">
                      {/* Suspend / Reactivate team */}
                      {(() => {
                        const isSuspended = selectedTeam.status === "paused" || selectedTeam.status === "cancelled";
                        if (!suspendConfirm) {
                          return isSuspended ? (
                            <button
                              onClick={() => { setSuspendConfirm(true); setSuspendMsg(""); }}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors"
                              style={{ borderColor: "#86efac", color: "#16a34a", background: "#f0fdf4" }}>
                              Reactivar equipo
                            </button>
                          ) : (
                            <button
                              onClick={() => { setSuspendConfirm(true); setSuspendMsg(""); }}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors"
                              style={{ borderColor: "#fca5a5", color: "#dc2626", background: "#fff5f5" }}>
                              Suspender equipo
                            </button>
                          );
                        }
                        return (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                            style={{ borderColor: isSuspended ? "#86efac" : "#fecaca", background: isSuspended ? "#f0fdf4" : "#fff5f5" }}>
                            <span className="text-xs font-bold" style={{ color: isSuspended ? "#15803d" : "#dc2626" }}>¿Confirmás?</span>
                            <button
                              onClick={() => isSuspended ? reactivateTeam(selectedTeam.id) : suspendTeam(selectedTeam.id)}
                              disabled={suspendLoading}
                              className="text-xs font-black text-white px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all"
                              style={{ background: isSuspended ? "#16a34a" : "#dc2626" }}>
                              {suspendLoading ? <Loader2 size={10} className="animate-spin" /> : null}
                              {isSuspended ? "Sí, reactivar" : "Sí, suspender"}
                            </button>
                            <button
                              onClick={() => { setSuspendConfirm(false); setSuspendMsg(""); }}
                              className="text-xs font-semibold text-gray-400 hover:text-gray-600 px-1.5">
                              Cancelar
                            </button>
                          </div>
                        );
                      })()}
                      {suspendMsg && (
                        <span className={`text-xs font-bold ${suspendMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                          {suspendMsg}
                        </span>
                      )}
                      {/* Cerrar panel */}
                      <button
                        onClick={() => { setSelectedTeam(null); setTeamMembers([]); setSuspendConfirm(false); setSuspendMsg(""); }}
                        title="Cerrar detalle"
                        className="text-xs font-semibold text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                        Cerrar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Miembros */}
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Miembros del equipo</span>
                  </div>

                  {teamMembersLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 size={20} className="animate-spin text-gray-300" />
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {/* Broker */}
                      {teamMembers.filter(m => m.team_role === "owner").map(m => (
                        <MemberRow key={m.email} m={m} roleLabel={ROLE_LABEL} roleColor={ROLE_COLOR} roleBg={ROLE_BG} planColor={PLAN_COLOR} planBg={PLAN_BG} planLabel={PLAN_LABEL} />
                      ))}
                      {/* Team Leaders */}
                      {teamMembers.filter(m => m.team_role === "team_leader").length > 0 && (
                        <div className="px-5 py-2 bg-gray-50">
                          <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Team Leaders</span>
                        </div>
                      )}
                      {teamMembers.filter(m => m.team_role === "team_leader").map(m => (
                        <MemberRow key={m.email} m={m} roleLabel={ROLE_LABEL} roleColor={ROLE_COLOR} roleBg={ROLE_BG} planColor={PLAN_COLOR} planBg={PLAN_BG} planLabel={PLAN_LABEL} />
                      ))}
                      {/* Agentes */}
                      {teamMembers.filter(m => m.team_role === "member").length > 0 && (
                        <div className="px-5 py-2 bg-gray-50">
                          <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Agentes</span>
                        </div>
                      )}
                      {teamMembers.filter(m => m.team_role === "member").map(m => (
                        <MemberRow key={m.email} m={m} roleLabel={ROLE_LABEL} roleColor={ROLE_COLOR} roleBg={ROLE_BG} planColor={PLAN_COLOR} planBg={PLAN_BG} planLabel={PLAN_LABEL} />
                      ))}
                      {teamMembers.length === 0 && (
                        <div className="px-5 py-8 text-center text-sm text-gray-400">Sin miembros</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* OPERACIONES */}
        {tab === "ops" && (
          <div className="space-y-4">

            {/* Operaciones del sistema */}
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: "Deep Sync", desc: "Sincroniza 365 días de calendario para todos los usuarios. Corre automáticamente los domingos a las 3am.", action: "trigger_deep_sync", icon: <RefreshCw size={16} style={{ color: RED }} />, label: "Ejecutar ahora" },
              ].map((op, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">{op.icon}</div>
                    <div><div className="font-black text-sm text-gray-900">{op.title}</div><div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{op.desc}</div></div>
                  </div>
                  <button onClick={() => triggerOp(op.action)} disabled={opsLoading}
                    className="w-full py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: RED }}>
                    {opsLoading ? <Loader2 size={11} className="animate-spin" /> : null}{op.label}
                  </button>
                </div>
              ))}
            </div>

            {/* Centro de Emails */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <Mail size={16} style={{ color: RED }} />
                <div className="font-black text-sm text-gray-900">Centro de Emails</div>
              </div>

              {/* Paso 1: Seleccionar template */}
              <div className="mb-5">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">1. Seleccioná el email</div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "welcome", label: "Bienvenida", desc: "Mail de bienvenida al registrarse", icon: "👋" },
                    { id: "weekly",  label: "Informe semanal", desc: "Informe con IAC, stats y consejo del coach", icon: "📊" },
                  ] as const).map(t => (
                    <button key={t.id} onClick={() => setEmailTemplate(t.id)}
                      className="text-left p-3 rounded-xl border-2 transition-all"
                      style={{ borderColor: emailTemplate === t.id ? RED : "#e5e7eb", background: emailTemplate === t.id ? "#fff5f5" : "#f9fafb" }}>
                      <div className="text-base mb-1">{t.icon}</div>
                      <div className="text-xs font-black text-gray-900">{t.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Paso 2: Destinatarios */}
              <div className="mb-5">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">2. Destinatarios</div>
                <div className="flex gap-2 mb-3">
                  {([
                    { id: "specific", label: "Usuarios específicos" },
                    { id: "all",      label: "Toda la base" },
                  ] as const).map(r => (
                    <button key={r.id} onClick={() => { setEmailRecipient(r.id); setEmailSelected([]); setEmailSearch(""); setEmailSearchResults([]); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{ background: emailRecipient === r.id ? RED : "#f3f4f6", color: emailRecipient === r.id ? "white" : "#6b7280" }}>
                      {r.label}
                    </button>
                  ))}
                </div>

                {emailRecipient === "specific" && (
                  <div>
                    <div className="relative mb-2">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                      <input value={emailSearch}
                        onChange={e => { setEmailSearch(e.target.value); searchEmailUsers(e.target.value); }}
                        placeholder="Buscar por email o nombre..."
                        className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
                    </div>
                    {emailSearchResults.length > 0 && (
                      <div className="border border-gray-100 rounded-xl overflow-hidden mb-2">
                        {emailSearchResults.map(u => (
                          <button key={u.email} onClick={() => {
                            if (!emailSelected.includes(u.email)) setEmailSelected(prev => [...prev, u.email]);
                            setEmailSearch(""); setEmailSearchResults([]);
                          }} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between border-b border-gray-50 last:border-0">
                            <span className="font-medium text-gray-800">{u.name || u.email}</span>
                            <span className="text-gray-400">{u.name ? u.email : ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {emailSelected.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {emailSelected.map(e => (
                          <span key={e} className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-700">
                            {e}
                            <button onClick={() => setEmailSelected(prev => prev.filter(x => x !== e))} className="text-gray-400 hover:text-red-500 ml-0.5">✕</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {emailRecipient === "all" && (
                  <div className="text-xs text-gray-400 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    ⚠️ Se enviará a <strong>todos los usuarios activos</strong> en la base de datos.
                  </div>
                )}
              </div>

              {/* Resultado */}
              {emailResult && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-xs font-semibold ${emailResult.failed === 0 ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                  ✓ {emailResult.sent} enviados · {emailResult.failed} errores · {emailResult.total} total
                  {emailResult.errors?.length > 0 && (
                    <div className="mt-1 font-normal text-xs text-gray-500">{emailResult.errors.slice(0,3).join(" · ")}</div>
                  )}
                </div>
              )}
              {opsMsg && <div className="mb-4 text-xs text-red-500 font-semibold">{opsMsg}</div>}

              {/* Enviar */}
              <button onClick={sendEmails} disabled={emailSending || (emailRecipient === "specific" && emailSelected.length === 0)}
                className="w-full py-3 rounded-xl text-sm font-black text-white transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: RED }}>
                {emailSending ? <><Loader2 size={14} className="animate-spin" /> Enviando...</> : `Enviar "${emailTemplate === "welcome" ? "Bienvenida" : "Informe semanal"}" ${emailRecipient === "all" ? "a todos" : emailSelected.length > 0 ? `a ${emailSelected.length} usuario${emailSelected.length > 1 ? "s" : ""}` : ""}`}
              </button>
            </div>
          </div>
        )}


        {tab === "eventos" && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <div className="text-sm font-black text-gray-800">Tipos de evento</div>
                  <div className="text-xs text-gray-400 mt-0.5">Keywords separadas por coma — si el título del evento las contiene, se clasifica como ese tipo.</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEtForm({ ...EMPTY_ET })}
                    className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:border-gray-400 transition-all">
                    + Agregar tipo
                  </button>
                  <button onClick={saveEventTypes} disabled={eventTypesSaving}
                    className="text-xs font-bold px-4 py-2 rounded-xl text-white transition-all disabled:opacity-50"
                    style={{ background: RED }}>
                    {eventTypesSaving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                <div className="grid px-5 py-2 text-xs font-black text-gray-400 uppercase tracking-widest bg-gray-50"
                  style={{ gridTemplateColumns: "1fr 1fr 70px 70px 70px 56px" }}>
                  <div>Tipo</div><div>Keywords</div>
                  <div className="text-center">Verde</div>
                  <div className="text-center">Proceso</div>
                  <div className="text-center">Cierre</div>
                  <div></div>
                </div>
                {eventTypes.map((et, idx) => (
                  <div key={et.event_type} className="grid px-5 py-3 items-center hover:bg-gray-50"
                    style={{ gridTemplateColumns: "1fr 1fr 70px 70px 70px 56px" }}>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{et.label || et.event_type}</div>
                      <div className="text-xs text-gray-400 font-mono flex items-center gap-1">
                        {et.event_type}
                        {et.is_custom && <span className="px-1 py-0.5 bg-blue-50 text-blue-500 rounded text-xs">custom</span>}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 truncate pr-2">{et.keywords || <span className="italic text-gray-300">—</span>}</div>
                    {(["is_green","is_proceso","is_cierre"] as const).map(field => (
                      <div key={field} className="flex justify-center">
                        <div onClick={() => setEventTypes(prev => prev.map((e, i) => i === idx ? { ...e, [field]: !e[field] } : e))}
                          className="relative w-10 h-5 rounded-full cursor-pointer transition-colors"
                          style={{ background: et[field] ? (field === "is_green" ? RED : field === "is_proceso" ? "#16a34a" : "#d97706") : "#e5e7eb" }}>
                          <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
                            style={{ left: et[field] ? "calc(100% - 18px)" : "2px" }} />
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-center gap-1">
                      <button onClick={() => setEtForm({ ...et })}
                        className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 transition-all">✏️</button>
                      {et.is_custom && (
                        <button onClick={() => { if (confirm(`¿Eliminar "${et.label}"?`)) setEventTypes(prev => prev.filter((_, i) => i !== idx)); }}
                          className="text-xs px-2 py-1 rounded-lg border border-red-100 text-red-400 hover:border-red-300 transition-all">✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-xs text-amber-800">
              <strong>Nota:</strong> Los cambios afectan las <strong>próximas sincronizaciones</strong>. Para re-procesar eventos históricos con la nueva config, corrés el rebuild desde Ops.
            </div>

            {etForm !== null && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
                  <div className="text-sm font-black text-gray-800">
                    {!eventTypes.find(e => e.event_type === etForm.event_type) ? "Nuevo tipo de evento" : `Editar: ${etForm.label}`}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Nombre visible</label>
                      <input value={etForm.label} onChange={e => setEtForm((f: any) => ({ ...f, label: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                        placeholder="Ej: Reunión de seguimiento" />
                    </div>
                    {etForm.is_custom && !eventTypes.find(e => e.event_type === etForm.event_type) && (
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">ID interno <span className="text-gray-300 font-normal">(solo letras y _)</span></label>
                        <input value={etForm.event_type}
                          onChange={e => setEtForm((f: any) => ({ ...f, event_type: e.target.value.replace(/[^a-z0-9_]/g,"_").toLowerCase() }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-gray-400"
                          placeholder="Ej: seguimiento" />
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Keywords <span className="text-gray-300 font-normal">(separadas por coma)</span></label>
                      <input value={etForm.keywords} onChange={e => setEtForm((f: any) => ({ ...f, keywords: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                        placeholder="Ej: seguimiento,follow up" />
                      <p className="text-xs text-gray-400 mt-1">Si el título del evento contiene alguna de estas palabras, se clasifica como este tipo.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-1">
                      {([["is_green","Verde",RED],["is_proceso","Proceso","#16a34a"],["is_cierre","Cierre","#d97706"]] as const).map(([field,label,color]) => (
                        <div key={field} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100">
                          <span className="text-xs font-semibold text-gray-600">{label}</span>
                          <div onClick={() => setEtForm((f: any) => ({ ...f, [field]: !f[field] }))}
                            className="relative w-10 h-5 rounded-full cursor-pointer transition-colors"
                            style={{ background: etForm[field] ? color : "#e5e7eb" }}>
                            <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
                              style={{ left: etForm[field] ? "calc(100% - 18px)" : "2px" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setEtForm(null)}
                      className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:border-gray-400 transition-all">
                      Cancelar
                    </button>
                    <button onClick={() => {
                        if (!etForm.label.trim() || !etForm.event_type.trim()) return;
                        setEventTypes(prev => {
                          const idx = prev.findIndex(e => e.event_type === etForm.event_type);
                          if (idx >= 0) { const n = [...prev]; n[idx] = etForm; return n; }
                          return [...prev, etForm];
                        });
                        setEtForm(null);
                      }}
                      disabled={!etForm.label.trim() || !etForm.event_type.trim()}
                      className="flex-1 py-2 rounded-xl text-sm font-black text-white transition-all disabled:opacity-40"
                      style={{ background: RED }}>
                      Guardar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "precios" && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                Modificá el precio de los planes en MercadoPago. El cambio aplica a todos los nuevos suscriptores inmediatamente.
                Los suscriptores activos continúan pagando el precio anterior hasta su próxima renovación.
              </p>
            </div>

            {plansLoading ? (
              <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { id: "individual", label: "Plan Individual", desc: "Inmobiliario solo" },
                  { id: "teams", label: "Plan Teams", desc: "Broker con equipo — hasta 10 agentes" },
                ].map(({ id, label, desc }) => {
                  const p = plans[id] || {};
                  return (
                    <div key={id} className="bg-white border border-gray-100 rounded-2xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="font-black text-base text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{label}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
                        </div>
                        <div className={`text-xs font-bold px-2 py-1 rounded-lg ${p.status === "active" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                          {p.status || "—"}
                        </div>
                      </div>

                      {p.error ? (
                        <p className="text-xs text-red-400">{p.error}</p>
                      ) : (
                        <>
                          <div className="mb-1 text-xs text-gray-400">Precio actual en MP</div>
                          <div className="text-3xl font-black mb-4" style={{ color: RED, fontFamily: "Georgia, serif" }}>
                            $ {p.amount ? Number(p.amount).toLocaleString("es-AR") : "—"}
                            <span className="text-sm font-normal text-gray-400 ml-1">/mes</span>
                          </div>

                          <div className="mb-1 text-xs text-gray-400">Nuevo precio (ARS)</div>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={planInputs[id] || ""}
                              onChange={e => setPlanInputs(prev => ({ ...prev, [id]: e.target.value }))}
                              onKeyDown={e => e.key === "Enter" && updatePlanPrice(id)}
                              placeholder="Ej: 12000"
                              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-400 transition-colors"
                            />
                            <button
                              onClick={() => updatePlanPrice(id)}
                              disabled={planSaving === id || planInputs[id] === String(p.amount)}
                              className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40 hover:opacity-90 transition-all"
                              style={{ background: RED }}>
                              {planSaving === id ? <Loader2 size={12} className="animate-spin" /> : "Actualizar"}
                            </button>
                          </div>
                          {planMsg[id] && (
                            <p className={`text-xs mt-2 font-semibold ${planMsg[id].startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                              {planMsg[id]}
                            </p>
                          )}
                          <p className="text-xs text-gray-300 mt-3">ID: {p.id}</p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "goals" && (
          <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-1">Configuración de Goals</h2>
              <p className="text-xs text-gray-400">Estos valores afectan el cálculo de IAC y días productivos para todos los agentes.</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Meta semanal de reuniones (IAC 100%)</label>
                <p className="text-xs text-gray-400 mb-2">Cantidad de reuniones cara a cara por semana para alcanzar el 100% de IAC. Default: 15</p>
                <input
                  type="number" min="1" max="100"
                  value={goalsConfig.weekly_goal}
                  onChange={e => setGoalsConfig(p => ({ ...p, weekly_goal: e.target.value }))}
                  className="w-32 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Mínimo de reuniones para día productivo</label>
                <p className="text-xs text-gray-400 mb-2">Cuántas reuniones verdes necesita un agente en un día para que cuente como "día productivo". Default: 2</p>
                <input
                  type="number" min="1" max="20"
                  value={goalsConfig.productive_day_min}
                  onChange={e => setGoalsConfig(p => ({ ...p, productive_day_min: e.target.value }))}
                  className="w-32 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={async () => {
                    setGoalsSaving(true); setGoalsMsg("");
                    try {
                      await fetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "weekly_goal", value: goalsConfig.weekly_goal }) });
                      await fetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "productive_day_min", value: goalsConfig.productive_day_min }) });
                      setGoalsMsg("✓ Guardado");
                    } catch { setGoalsMsg("Error al guardar"); }
                    setGoalsSaving(false);
                  }}
                  disabled={goalsSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                  style={{ background: RED }}>
                  {goalsSaving ? "Guardando..." : "Guardar"}
                </button>
                {goalsMsg && <span className={`text-xs font-semibold ${goalsMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>{goalsMsg}</span>}
              </div>
            </div>
            <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
              <p className="text-xs text-blue-700 font-medium">Los cambios se aplican en el próximo ciclo de sincronización. El mail semanal del lunes usará los nuevos valores automáticamente.</p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

function MemberRow({ m, roleLabel, roleColor, roleBg, planColor, planBg, planLabel }: {
  m: any;
  roleLabel: Record<string, string>;
  roleColor: Record<string, string>;
  roleBg: Record<string, string>;
  planColor: Record<string, string>;
  planBg: Record<string, string>;
  planLabel: Record<string, string>;
}) {
  return (
    <div className="px-5 py-4 flex items-center gap-3">
      {m.avatar ? (
        <img src={m.avatar} alt="" className="w-8 h-8 rounded-full shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-400 shrink-0">
          {(m.name || m.email)[0].toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-800">{m.name || m.email}</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
            style={{ background: roleBg[m.team_role] || "#f3f4f6", color: roleColor[m.team_role] || "#6b7280" }}>
            {roleLabel[m.team_role] || m.team_role}
          </span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
            style={{ background: planBg[m.plan] || "#f3f4f6", color: planColor[m.plan] || "#6b7280" }}>
            {planLabel[m.plan] || m.plan}
          </span>
          {m.status === "cancelled" && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-red-50 text-red-400">Cancelado</span>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">{m.email}</div>
      </div>
    </div>
  );
}

function SendToUser({ onSend, loading }: { onSend: (email: string) => void; loading: boolean }) {
  const [email, setEmail] = useState("");
  return (
    <div className="flex gap-2">
      <input value={email} onChange={e => setEmail(e.target.value)}
        placeholder="email@dominio.com"
        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-400 transition-colors" />
      <button onClick={() => email && onSend(email)} disabled={loading || !email}
        className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 hover:opacity-90"
        style={{ background: RED }}>
        Enviar
      </button>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const redirect = await requireSuperAdmin(ctx);
  if (redirect) return redirect;
  return { props: {} };
};
