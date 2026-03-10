import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import React, { useEffect, useState } from "react";
import { ArrowLeft, Users, User, AlertTriangle, Loader2, CheckCircle, UserPlus, Mail, Clock, Shield, X, ChevronUp, ChevronDown, Info } from "lucide-react";
import TeamsPricingWidget from "../components/TeamsPricingWidget";
import { pricePerAgent, formatPriceARS } from "../lib/pricing";

const RED = "#aa0000";
const BASE_PRICE = 10500;

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const ref = React.useRef<HTMLButtonElement>(null);
  const [above, setAbove] = useState(false);

  const handleShow = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setAbove(rect.top > 180);
    }
    setShow(true);
  };

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={ref}
        onMouseEnter={handleShow}
        onMouseLeave={() => setShow(false)}
        onTouchStart={() => { handleShow(); }}
        className="text-gray-300 hover:text-gray-500 transition-colors ml-1 align-middle"
        type="button"
      >
        <Info size={13} />
      </button>
      {show && (
        <span
          className="absolute w-64 bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl leading-relaxed pointer-events-none"
          style={{
            zIndex: 9999,
            left: "50%",
            transform: "translateX(-50%)",
            ...(above
              ? { bottom: "calc(100% + 8px)" }
              : { top: "calc(100% + 8px)" }),
          }}
        >
          {text}
          <span
            className="absolute border-4 border-transparent"
            style={above
              ? { top: "100%", left: "50%", transform: "translateX(-50%)", borderTopColor: "#111827" }
              : { bottom: "100%", left: "50%", transform: "translateX(-50%)", borderBottomColor: "#111827" }
            }
          />
        </span>
      )}
    </span>
  );
}

interface CuentaData {
  plan: string;
  status: string;
  agentCount: number;
  total: number;
  tier: string;
  discountPct: number;
  currentPeriodEnd: string | null;
  nextPaymentDate: string | null;
  mpSubscriptionId: string | null;
  agencyName: string | null;
  teamRole: string | null;
  isOwner: boolean;
  isVip?: boolean;
  mpStatus?: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

export default function CuentaPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [data, setData] = useState<CuentaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [pending, setPending] = useState<any[]>([]);
  const [agencyInput, setAgencyInput] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [agencySaving, setAgencySaving] = useState(false);
  const [agencyMsg, setAgencyMsg] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [showTeamLeaders, setShowTeamLeaders] = useState(true);
  const [showBroker, setShowBroker] = useState(true);
  const [anonymizeGlobal, setAnonymizeGlobal] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/cuenta")
      .then(r => r.json())
      .then(d => { setData(d); })
      .finally(() => setLoading(false));
    // Load team management data if owner
    fetch("/api/teams/invite").then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setPending(d.pending || []); }
    });
    fetch("/api/teams/members").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.members) setTeamMembers(d.members);
    });
    fetch("/api/teams/agency").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.agencyName) { setAgencyName(d.agencyName); setAgencyInput(d.agencyName); }
    });
    fetch("/api/teams/settings").then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setShowTeamLeaders(d.showTeamLeaders ?? true); setShowBroker(d.showBroker ?? true); setAnonymizeGlobal(d.anonymizeGlobal ?? false); }
    });
  }, [status]);


  const handleCancel = async () => {
    if (cancelConfirm.toLowerCase() !== "cancelar") return;
    setActionLoading(true);
    await fetch("/api/cuenta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    setActionLoading(false);
    setSuccess("Suscripción cancelada. Seguís con acceso hasta el fin del período.");
    setShowCancel(false);
    setTimeout(() => router.push("/"), 3000);
  };

  const saveSetting = async (key: string, value: boolean) => {
    setSettingsSaving(true);
    await fetch("/api/teams/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }) });
    setSettingsSaving(false);
  };

  const changeRole = async (memberEmail: string, newRole: "team_leader" | "member") => {
    setRoleLoading(memberEmail);
    const res = await fetch("/api/teams/role", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberEmail, newRole }) });
    const d = await res.json();
    if (d.ok) {
      fetch("/api/teams/members").then(r => r.json()).then(d => { if (d?.members) setTeamMembers(d.members); });
    } else alert(d.error);
    setRoleLoading(null);
  };

  const invite = async () => {
    if (!newEmail.includes("@")) { setInviteMsg("Email inválido"); return; }
    setInviting(true); setInviteMsg("");
    const res = await fetch("/api/teams/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: newEmail }) });
    const d = await res.json();
    if (d.ok) { setInviteMsg(`Invitación enviada a ${newEmail}`); setNewEmail(""); fetch("/api/teams/invite").then(r=>r.json()).then(d=>setPending(d.pending||[])); }
    else setInviteMsg(d.error || "Error");
    setInviting(false);
  };

  const removeAgent = async (email: string) => {
    if (removeConfirm !== email) { setRemoveConfirm(email); return; }
    setRemoveLoading(email); setRemoveConfirm(null);
    const res = await fetch("/api/teams/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberEmail: email }) });
    const d = await res.json();
    if (d.ok) { fetch("/api/teams/members").then(r=>r.json()).then(d=>{ if(d?.members) setTeamMembers(d.members); }); fetch("/api/cuenta").then(r=>r.json()).then(d=>setData(d)); }
    setRemoveLoading(null);
  };

  const saveAgency = async () => {
    setAgencySaving(true);
    const res = await fetch("/api/teams/agency", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agencyName: agencyInput }) });
    const d = await res.json();
    if (d.ok) { setAgencyName(agencyInput); setAgencyMsg("Guardado"); setTimeout(() => setAgencyMsg(""), 2000); }
    setAgencySaving(false);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin" style={{ color: RED }} />
      </div>
    );
  }

  if (!data) return null;

  const isPaid = (data.plan !== "free" && data.status === "active") || data.isVip === true;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>Mi cuenta — InmoCoach</title></Head>
      <div className="h-1 w-full" style={{ background: RED }} />

      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-xl mx-auto px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.push("/")} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={13} /> Dashboard
          </button>
          <div className="font-black text-lg ml-auto" style={{ fontFamily: "Georgia, serif" }}>
            Mi <span style={{ color: RED }}>cuenta</span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 py-6 space-y-4">

        {/* Éxito */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <CheckCircle size={16} className="text-green-600 shrink-0" />
            <p className="text-sm font-semibold text-green-700">{success}</p>
          </div>
        )}

        {/* Plan actual */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Plan actual</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: isPaid ? "#fef2f2" : "#f3f4f6" }}>
                  {data.isOwner ? <Users size={18} style={{ color: isPaid ? RED : "#9ca3af" }} />
                    : <User size={18} style={{ color: isPaid ? RED : "#9ca3af" }} />}
                </div>
                <div>
                  <div className="font-black text-gray-900">
                    {data.plan === "free" ? "Prueba gratuita"
                      : data.isOwner ? `Equipo · ${data.tier}`
                      : "Individual"}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {data.plan === "free" ? "7 días gratis"
                      : data.isOwner ? `${data.agentCount} agente${data.agentCount !== 1 ? "s" : ""}`
                      : "1 agente"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-2xl" style={{ fontFamily: "Georgia, serif", color: isPaid ? RED : "#9ca3af", lineHeight: 1 }}>
                  {isPaid ? formatPriceARS(data.total) : "$0"}
                </div>
                <div className="text-xs text-gray-400">/mes</div>
              </div>
            </div>
          </div>

          {/* Info de facturación */}
          {isPaid && (
            <div className="px-5 py-3 bg-gray-50 space-y-2">
              {data.discountPct > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Precio por agente</span>
                  <span className="font-bold text-green-600">{formatPriceARS(pricePerAgent(BASE_PRICE, data.agentCount))}/agente · -{data.discountPct}%</span>
                </div>
              )}
              {data.nextPaymentDate && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Próximo cobro</span>
                  <span className="font-semibold text-gray-700">{formatDate(data.nextPaymentDate)}</span>
                </div>
              )}
            </div>
          )}
        </div>



        {/* VIP badge */}
        {data.isVip && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <span className="text-2xl">👑</span>
            <div>
              <p className="text-sm font-black text-amber-800">Cuenta VIP activa permanente</p>
              <p className="text-xs text-amber-600 mt-0.5">Acceso completo sin vencimiento · Sin cobro</p>
            </div>
          </div>
        )}

        {/* ── GESTIÓN DE EQUIPO (solo owners) ── */}
        {isPaid && data.isOwner && (
          <>
            {/* Nombre de la inmobiliaria */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={14} className="text-gray-400" />
                <span className="font-black text-sm text-gray-900">Nombre de la inmobiliaria</span>
              </div>
              <div className="flex gap-2">
                <input value={agencyInput} onChange={e => setAgencyInput(e.target.value)} onKeyDown={e => e.key === "Enter" && saveAgency()}
                  placeholder="Ej: GALAS Propiedades"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400" />
                <button onClick={saveAgency} disabled={agencySaving || agencyInput === agencyName}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40 hover:opacity-90" style={{ background: RED }}>
                  {agencySaving ? <Loader2 size={12} className="animate-spin" /> : "Guardar"}
                </button>
              </div>
              {agencyMsg && <p className="text-xs mt-2 font-medium text-green-600">{agencyMsg}</p>}
            </div>

            {/* Pricing widget */}
            <TeamsPricingWidget
              agentCount={data.agentCount}
              onInvite={() => document.getElementById("invite-input")?.focus()}
            />

            {/* Invitar agente */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus size={14} style={{ color: RED }} />
                <span className="font-black text-sm text-gray-900">Invitar agente</span><Tooltip text="Cada agente que invitás suma un seat al plan. El precio por agente baja automáticamente al alcanzar 5, 10 o 20 usuarios activos (incluye al broker)." />
                <span className="ml-auto text-xs text-gray-400">{data.agentCount} activos</span>
              </div>
              <div className="flex gap-2">
                <input id="invite-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && invite()} placeholder="email@dominio.com"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400" />
                <button onClick={invite} disabled={inviting || !newEmail}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 hover:opacity-90"
                  style={{ background: RED }}>
                  {inviting ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
                  {inviting ? "Enviando..." : "Invitar"}
                </button>
              </div>
              {inviteMsg && <p className={`text-xs mt-2 font-medium ${inviteMsg.includes("nviada") ? "text-green-600" : "text-red-500"}`}>{inviteMsg}</p>}
            </div>

            {/* Usuarios activos */}
            {teamMembers.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <Users size={13} className="text-gray-400" />
                  <span className="text-xs font-black text-gray-500 uppercase tracking-widest">{teamMembers.length} usuarios activos</span><Tooltip text="El plan se cobra por la cantidad de usuarios activos en tu equipo, incluyendo vos como broker. Remover un usuario reduce el costo en el próximo ciclo de facturación." />
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: "#fef2f2", color: RED }}>{teamMembers.length} seat{teamMembers.length !== 1 ? "s" : ""} activos</span>
                </div>
                <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-100 flex items-start gap-2">
                  <Info size={12} className="text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Tu plan se factura por <strong>{teamMembers.length} usuario{teamMembers.length !== 1 ? "s" : ""}</strong> — el mínimo contratado no puede ser menor a los usuarios activos. Para reducir el costo, primero removés el usuario y el plan baja automáticamente al siguiente ciclo.
                  </p>
                </div>
                <div className="divide-y divide-gray-50">
                  {teamMembers.map((a: any) => {
                    const role = a.team_role || a.teamRole;
                    return (
                    <div key={a.email} className="flex items-center gap-3 px-5 py-3">
                      {a.avatar ? <img src={a.avatar} className="w-8 h-8 rounded-full shrink-0" /> :
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-400 shrink-0">{(a.name||a.email)[0].toUpperCase()}</div>}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800 truncate">{a.name || a.email}</div>
                        {a.name && <div className="text-xs text-gray-400 truncate">{a.email}</div>}
                      </div>
                      {role === "owner" ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg shrink-0" style={{ background: "#fef2f2", color: RED }}>Broker</span>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          {roleLoading === a.email ? <Loader2 size={12} className="animate-spin text-gray-300" /> : (
                            <select value={role}
                              onChange={e => changeRole(a.email, e.target.value as "team_leader" | "member")}
                              className="text-xs font-semibold text-gray-600 bg-gray-100 border-0 rounded-lg px-2 py-1.5 cursor-pointer focus:outline-none appearance-none">
                              <option value="member">Agente</option>
                              <option value="team_leader">Team Leader</option>
                            </select>
                          )}
                          <button onClick={() => removeAgent(a.email)} disabled={removeLoading === a.email}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${removeConfirm === a.email ? "bg-red-100 text-red-600" : "text-gray-300 hover:text-red-400 bg-gray-50"}`}>
                            {removeLoading === a.email ? <Loader2 size={11} className="animate-spin" /> : removeConfirm === a.email ? "¿Confirmar?" : "Remover"}
                          </button>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Invitaciones pendientes */}
            {pending.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <Clock size={13} className="text-gray-400" />
                  <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Invitaciones pendientes</span>
                  <span className="ml-auto text-xs text-gray-400">{pending.length}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {pending.map((inv: any) => (
                    <div key={inv.token} className="flex items-center gap-3 px-5 py-3 flex-wrap">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-400 shrink-0">{inv.email[0].toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-600 truncate">{inv.email}</div>
                        <div className="text-xs text-gray-400">Pendiente de aceptar · {new Date(inv.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={async () => { await fetch("/api/teams/invitation", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action:"resend", token: inv.token}) }); }}
                          className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                          <Mail size={11} /> Reenviar
                        </button>
                        <button onClick={async () => { await fetch("/api/teams/invitation", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action:"cancel", token: inv.token}) }); fetch("/api/teams/invite").then(r=>r.json()).then(d=>setPending(d.pending||[])); }}
                          className="text-xs font-semibold text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preferencias de ranking */}
            <div className="bg-white border border-gray-100 rounded-2xl">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Preferencias de ranking</span><Tooltip text="Estas configuraciones solo afectan cómo se muestran los usuarios en el ranking interno del equipo. No afecta el costo ni el acceso." />
                {settingsSaving && <Loader2 size={11} className="animate-spin text-gray-300 ml-auto" />}
              </div>
              <div className="divide-y divide-gray-50">
                <label className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Mostrar Team Leaders en ranking del equipo</div>
                    <div className="text-xs text-gray-400 mt-0.5">Si está desactivado, solo aparecen los agentes (members)</div>
                  </div>
                  <div onClick={() => { const v = !showTeamLeaders; setShowTeamLeaders(v); saveSetting("showTeamLeaders", v); }}
                    className="relative shrink-0 ml-4 w-11 h-6 rounded-full transition-colors cursor-pointer"
                    style={{ background: showTeamLeaders ? RED : "#e5e7eb" }}>
                    <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200"
                      style={{ left: showTeamLeaders ? "calc(100% - 22px)" : "2px" }} />
                  </div>
                </label>
                <label className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Mostrar Broker en ranking del equipo</div>
                    <div className="text-xs text-gray-400 mt-0.5">Si está desactivado, el broker no aparece en el ranking interno</div>
                  </div>
                  <div onClick={() => { const v = !showBroker; setShowBroker(v); saveSetting("showBroker", v); }}
                    className="relative shrink-0 ml-4 w-11 h-6 rounded-full transition-colors cursor-pointer"
                    style={{ background: showBroker ? RED : "#e5e7eb" }}>
                    <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200"
                      style={{ left: showBroker ? "calc(100% - 22px)" : "2px" }} />
                  </div>
                </label>
                <label className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Anonimizar equipo en ranking global</div>
                    <div className="text-xs text-gray-400 mt-0.5">Los agentes aparecen como "Agente #N" en el ranking público</div>
                  </div>
                  <div onClick={() => { const v = !anonymizeGlobal; setAnonymizeGlobal(v); saveSetting("anonymizeGlobal", v); }}
                    className="relative shrink-0 ml-4 w-11 h-6 rounded-full transition-colors cursor-pointer"
                    style={{ background: anonymizeGlobal ? RED : "#e5e7eb" }}>
                    <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200"
                      style={{ left: anonymizeGlobal ? "calc(100% - 22px)" : "2px" }} />
                  </div>
                </label>
              </div>
            </div>

          </>
        )}

        {/* Cancelar */}
        {isPaid && !data.isVip && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <button onClick={() => setShowCancel(!showCancel)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-gray-400" />
                <span className="font-bold text-sm text-gray-500">Cancelar suscripción</span>
              </div>
              {showCancel ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
            </button>

            {showCancel && (
              <div className="px-5 pb-5 border-t border-gray-50">
                <div className="pt-4 space-y-3">
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <p className="text-sm text-red-700 font-semibold mb-1">¿Seguro que querés cancelar?</p>
                    <p className="text-xs text-red-500 leading-relaxed">
                      Seguís con acceso hasta el {formatDate(data.nextPaymentDate)}. Después tu cuenta vuelve al plan gratuito y perdés acceso al historial y al Inmo Coach.
                    </p>
                  </div>
                  <input
                    type="text"
                    placeholder='Escribí "cancelar" para confirmar'
                    value={cancelConfirm}
                    onChange={e => setCancelConfirm(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-300"
                  />
                  <button onClick={handleCancel}
                    disabled={cancelConfirm.toLowerCase() !== "cancelar" || actionLoading}
                    className="w-full py-3 rounded-xl font-black text-sm transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                    style={{ background: "#ef4444", color: "#fff" }}>
                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                    Cancelar suscripción
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Free — ir a pagar */}
        {!isPaid && (
          <div className="bg-white border border-gray-100 rounded-2xl px-5 py-5 text-center">
            <p className="text-sm text-gray-500 mb-4">No tenés una suscripción activa.</p>
            <button onClick={() => router.push("/pricing")}
              className="px-8 py-3 rounded-xl font-black text-white text-sm hover:opacity-90 transition-all"
              style={{ background: RED }}>
              Ver planes →
            </button>
          </div>
        )}

        <p className="text-xs text-center text-gray-300 pb-4">
          Para consultas sobre facturación escribí a <span className="text-gray-400">hola@inmocoach.com.ar</span>
        </p>
      </main>
    </div>
  );
}
