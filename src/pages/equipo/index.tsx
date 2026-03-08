import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import { ArrowLeft, UserPlus, Loader2, Mail, Users, CheckCircle, Clock, ChevronDown, AlertTriangle } from "lucide-react";

const RED = "#aa0000";

type TeamRole = "owner" | "team_leader" | "member";

interface Member {
  email: string;
  name?: string;
  avatar?: string;
  teamRole: TeamRole;
  plan: string;
  createdAt: string;
}

interface Pending {
  email: string;
  created_at: string;
  token: string;
}

const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Broker",
  team_leader: "Team Leader",
  member: "Agente",
};

const ROLE_COLOR: Record<TeamRole, string> = {
  owner: RED,
  team_leader: "#7c3aed",
  member: "#16a34a",
};

function PendingRow({ inv, onAction }: { inv: Pending; onAction: () => void }) {
  const [loading, setLoading] = useState<"resend" | "cancel" | null>(null);
  const [msg, setMsg] = useState("");

  const act = async (action: "resend" | "cancel") => {
    setLoading(action);
    setMsg("");
    try {
      const res = await fetch("/api/teams/invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token: inv.token }),
      });
      const data = await res.json();
      if (data.ok) {
        if (action === "cancel") { onAction(); return; }
        setMsg("Mail reenviado");
      } else {
        setMsg(data.error || "Error");
      }
    } catch { setMsg("Error de conexión"); }
    setLoading(null);
  };

  return (
    <div className="flex items-center gap-3 px-5 py-3 flex-wrap">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-400 shrink-0">
        {inv.email[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-600 truncate">{inv.email}</div>
        <div className="text-xs text-gray-400">
          Invitado el {new Date(inv.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
          {msg && <span className="ml-2 text-green-600 font-medium">{msg}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => act("resend")} disabled={!!loading}
          className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
          {loading === "resend" ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
          Reenviar
        </button>
        <button onClick={() => act("cancel")} disabled={!!loading}
          className="flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
          {loading === "cancel" ? <Loader2 size={11} className="animate-spin" /> : <span>✕</span>}
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function BrokerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [requesterRole, setRequesterRole] = useState<TeamRole | null>(null);
  const [brokerPlan, setBrokerPlan] = useState<string>("free");
  const [roleLoading, setRoleLoading] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") loadTeam();
  }, [status]);

  const loadTeam = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/teams/invite");
      if (res.status === 403) { router.replace("/"); return; }
      const data = await res.json();
      setMembers(data.members || []);
      setPending(data.pending || []);
      setRequesterRole(data.requesterRole);
      setBrokerPlan(data.brokerPlan || "free");
    } catch { }
    setLoading(false);
  };

  const invite = async () => {
    if (!newEmail.includes("@")) { setInviteMsg("Email inválido"); return; }
    setInviting(true);
    setInviteMsg("");
    try {
      const res = await fetch("/api/teams/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });
      const data = await res.json();
      if (data.ok) {
        setInviteMsg(`Invitación enviada a ${newEmail}`);
        setNewEmail("");
        loadTeam();
      } else {
        setInviteMsg(data.error || "Error al invitar");
      }
    } catch { setInviteMsg("Error de conexión"); }
    setInviting(false);
  };

  const changeRole = async (memberEmail: string, newRole: "team_leader" | "member") => {
    setRoleLoading(memberEmail);
    try {
      const res = await fetch("/api/teams/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberEmail, newRole }),
      });
      const data = await res.json();
      if (data.ok) loadTeam();
      else alert(data.error);
    } catch { alert("Error al cambiar rol"); }
    setRoleLoading(null);
  };

  const activeMembers = members.filter(m => m.teamRole !== "owner");
  const isOwner = requesterRole === "owner";
  const isFreemium = brokerPlan === "free";

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 size={24} className="animate-spin" style={{ color: RED }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>Mi Equipo — InstaCoach</title></Head>
      <div className="h-0.5 w-full" style={{ background: RED }} />

      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors mr-auto">
            <ArrowLeft size={13} /> Volver
          </button>
          <div className="font-black text-lg tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
            Insta<span style={{ color: RED }}>Coach</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-8 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>Mi Equipo</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {activeMembers.length} agente{activeMembers.length !== 1 ? "s" : ""} activo{activeMembers.length !== 1 ? "s" : ""} · {10 - activeMembers.length} lugar{10 - activeMembers.length !== 1 ? "es" : ""} disponible{10 - activeMembers.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="text-xs font-bold px-3 py-1.5 rounded-xl"
            style={{ background: isFreemium ? "#f3f4f6" : "#f0fdf4", color: isFreemium ? "#9ca3af" : "#16a34a" }}>
            {isFreemium ? "Trial — 7 días" : "Teams activo"}
          </div>
        </div>

        {/* Banner freemium */}
        {isFreemium && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Estás en el período de prueba</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Podés invitar agentes y probar el equipo. Al activar Teams, su acceso queda cubierto por vos — no pagan nada extra.
              </p>
              <button onClick={() => router.push("/pricing")}
                className="mt-2 text-xs font-bold underline text-amber-700 hover:text-amber-900">
                Activar plan Teams →
              </button>
            </div>
          </div>
        )}

        {/* Invitar — solo owner puede invitar */}
        {isOwner && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus size={15} className="text-gray-400" />
              <span className="font-black text-sm text-gray-900">Invitar agente</span>
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && invite()}
                placeholder="email@dominio.com"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-400 transition-colors"
              />
              <button onClick={invite} disabled={inviting || !newEmail}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-all hover:opacity-90"
                style={{ background: RED }}>
                {inviting ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
                {inviting ? "Enviando..." : "Invitar"}
              </button>
            </div>
            {inviteMsg && (
              <p className={`text-xs mt-2 font-medium ${inviteMsg.includes("nviada") ? "text-green-600" : "text-red-500"}`}>
                {inviteMsg}
              </p>
            )}
          </div>
        )}

        {/* Miembros */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Users size={13} className="text-gray-400" />
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Agentes del equipo</span>
            <span className="ml-auto text-xs font-bold text-gray-300">{activeMembers.length}/10</span>
          </div>
          {activeMembers.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              Todavía no tenés agentes en el equipo. Invitá al primero arriba.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {members.map(m => (
                <div key={m.email} className="flex items-center gap-3 px-5 py-3">
                  {m.avatar ? (
                    <img src={m.avatar} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-400">
                      {(m.name || m.email)[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">{m.name || m.email}</div>
                    {m.name && <div className="text-xs text-gray-400 truncate">{m.email}</div>}
                  </div>

                  {/* Badge de rol */}
                  <div className="text-xs font-bold px-2 py-0.5 rounded-lg"
                    style={{ background: `${ROLE_COLOR[m.teamRole]}15`, color: ROLE_COLOR[m.teamRole] }}>
                    {ROLE_LABEL[m.teamRole]}
                  </div>

                  {/* Cambio de rol — solo owner puede cambiar roles de no-owners */}
                  {isOwner && m.teamRole !== "owner" && (
                    <div className="relative">
                      {roleLoading === m.email ? (
                        <Loader2 size={13} className="animate-spin text-gray-400" />
                      ) : (
                        <select
                          value={m.teamRole}
                          onChange={e => changeRole(m.email, e.target.value as "team_leader" | "member")}
                          className="text-xs font-semibold text-gray-500 bg-gray-100 border-0 rounded-lg px-2 py-1 cursor-pointer focus:outline-none appearance-none pr-5">
                          <option value="member">Agente</option>
                          <option value="team_leader">Team Leader</option>
                        </select>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invitaciones pendientes */}
        {pending.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Clock size={13} className="text-gray-400" />
              <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Invitaciones pendientes</span>
            </div>
            <div className="divide-y divide-gray-50">
              {pending.map(p => (
                <PendingRow key={p.token} inv={p} onAction={loadTeam} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
