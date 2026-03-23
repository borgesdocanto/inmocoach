import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import AppLayout from "../components/AppLayout";
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
  teamId?: string | null;
  teamStatus?: string | null;
  teamPaidUntil?: string | null;
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
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);
  const [removeModal, setRemoveModal] = useState<{ email: string; name: string } | null>(null);
  const [retornarModal, setRetornarModal] = useState(false);
  const [retornarLoading, setRetornarLoading] = useState(false);
  const [removedMembers, setRemovedMembers] = useState<any[]>([]);
  const [reinviteLoading, setReinviteLoading] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
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

  const removeAgent = async (email: string, name: string) => {
    // Paso 1: pedir confirmación al API (devuelve warning)
    const check = await fetch("/api/teams/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberEmail: email }) });
    const checkData = await check.json();
    if (checkData.requiresConfirmation) {
      setRemoveModal({ email, name });
      return;
    }
  };

  const confirmRemove = async () => {
    if (!removeModal) return;
    const emailToRemove = removeModal.email; // capturar antes del async
    setRemoveLoading(emailToRemove);
    const res = await fetch("/api/teams/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberEmail: emailToRemove, confirmed: true }) });
    const d = await res.json();
    if (d.ok) {
      setRemoveModal(null);
      fetch("/api/teams/members").then(r=>r.json()).then(d=>{ if(d?.members) setTeamMembers(d.members); });
      fetch("/api/cuenta").then(r=>r.json()).then(d=>setData(d));
      loadRemovedMembers();
    } else {
      alert(d.error || "Error al remover el agente");
    }
    setRemoveLoading(null);
  };

  const loadRemovedMembers = async () => {
    const res = await fetch("/api/teams/removed-members");
    if (res.ok) { const d = await res.json(); setRemovedMembers(d.removed || []); }
  };

  const reinviteAgent = async (email: string) => {
    setReinviteLoading(email);
    const res = await fetch("/api/teams/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const d = await res.json();
    if (d.ok) { alert(`Invitación enviada a ${email}`); }
    else { alert(d.error || "Error al invitar"); }
    setReinviteLoading(null);
  };

  const retornarConEquipo = async () => {
    setRetornarLoading(true);
    // Ir al checkout con la cantidad de agentes que tenía
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentCount: data?.agentCount || 1 }),
    });
    const d = await res.json();
    if (d.checkoutUrl) window.location.href = d.checkoutUrl;
    else setRetornarLoading(false);
  };

  const retornarIndividual = async () => {
    setRetornarLoading(true);
    // Primero resetear equipo
    await fetch("/api/cuenta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_to_individual" }),
    });
    // Luego ir al checkout individual
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentCount: 1 }),
    });
    const d = await res.json();
    if (d.checkoutUrl) window.location.href = d.checkoutUrl;
    else setRetornarLoading(false);
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

  const [rankingOpen, setRankingOpen] = useState(false);

  if (!data) return null;

  const isPaid = (data.plan !== "free" && data.status === "active") || data.isVip === true;

  return (
    <AppLayout>
      <Head><title>Mi cuenta — InmoCoach</title></Head>

      <style>{`
        .mc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .mc-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        @media (max-width: 900px) { .mc-grid { grid-template-columns: 1fr; } .mc-grid-3 { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 600px) { .mc-grid-3 { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ padding: "24px 24px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: "#111827", fontFamily: "Georgia, serif" }}>Mi cuenta</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Plan, equipo y configuración</div>
        </div>

        {success && (
          <div style={{ background: "#EAF3DE", border: "0.5px solid #86efac", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle size={15} style={{ color: "#16a34a", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#166534" }}>{success}</span>
          </div>
        )}

        {data.isVip && (
          <div style={{ background: "#FFFBEB", border: "0.5px solid #fcd34d", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>👑</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#92400e" }}>Cuenta VIP — acceso permanente</div>
              <div style={{ fontSize: 12, color: "#b45309" }}>Todo desbloqueado sin vencimiento · Sin cobro</div>
            </div>
          </div>
        )}

        <div className="mc-grid" style={{ marginBottom: 16 }}>

          {/* ── COL IZQUIERDA ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Plan actual */}
            <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ background: "#111827", padding: "20px" }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Plan actual</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(170,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {data.isOwner ? <Users size={20} color="#fff" /> : <User size={20} color="#fff" />}
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 500, color: "#fff", fontFamily: "Georgia, serif" }}>
                        {data.plan === "free" ? "Prueba gratuita"
                          : data.isOwner ? `Equipo · ${data.tier}`
                          : "Individual"}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                        {data.plan === "free" ? "7 días gratis" : data.isOwner ? `${data.agentCount} agente${data.agentCount !== 1 ? "s" : ""}` : "1 agente"}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 32, fontWeight: 500, fontFamily: "Georgia, serif", color: isPaid ? RED : "#6b7280", lineHeight: 1 }}>
                      {isPaid ? formatPriceARS(data.total) : "$0"}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>/mes</div>
                  </div>
                </div>
                {isPaid && data.discountPct > 0 && (
                  <div style={{ marginTop: 12, fontSize: 12, color: "#4ade80" }}>
                    ✓ {data.discountPct}% de descuento por volumen aplicado
                  </div>
                )}
                {isPaid && data.nextPaymentDate && (
                  <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                    Próximo cobro: {formatDate(data.nextPaymentDate)}
                  </div>
                )}
              </div>
              {!isPaid && (
                <div style={{ padding: 16 }}>
                  <button onClick={() => router.push("/pricing")}
                    style={{ width: "100%", background: RED, color: "#fff", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                    Ver planes →
                  </button>
                </div>
              )}
            </div>

            {/* Nombre inmobiliaria */}
            {isPaid && data.isOwner && (
              <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Nombre de la inmobiliaria</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>Se muestra en el dashboard del equipo</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={agencyInput} onChange={e => setAgencyInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && saveAgency()}
                    placeholder="Ej: GALAS Propiedades"
                    style={{ flex: 1, border: "0.5px solid #d1d5db", borderRadius: 10, padding: "9px 12px", fontSize: 13, outline: "none", background: "#f9fafb" }} />
                  <button onClick={saveAgency} disabled={agencySaving || agencyInput === agencyName}
                    style={{ background: agencyInput !== agencyName ? RED : "#e5e7eb", color: agencyInput !== agencyName ? "#fff" : "#9ca3af", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 12, fontWeight: 500, cursor: agencyInput !== agencyName ? "pointer" : "not-allowed" }}>
                    {agencySaving ? "..." : "Guardar"}
                  </button>
                </div>
                {agencyMsg && <div style={{ fontSize: 11, color: "#16a34a", marginTop: 6 }}>✓ {agencyMsg}</div>}
              </div>
            )}

            {/* Preferencias de ranking — submenú colapsable */}
            {isPaid && data.isOwner && (
              <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                <button onClick={() => setRankingOpen(o => !o)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>Preferencias de ranking</span>
                    {settingsSaving && <Loader2 size={11} style={{ color: "#9ca3af" }} className="animate-spin" />}
                  </div>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>{rankingOpen ? "▲" : "▼"}</span>
                </button>
                {rankingOpen && (
                  <div style={{ borderTop: "0.5px solid #f3f4f6" }}>
                    <div style={{ padding: "10px 20px 4px", fontSize: 11, color: "#9ca3af" }}>
                      Configurá cómo se muestran los usuarios en el ranking interno del equipo.
                    </div>
                    {[
                      { label: "Mostrar Broker en ranking", sub: "Si está desactivado, el broker no aparece en el ranking interno", val: showBroker, set: setShowBroker, key: "showBroker" },
                      { label: "Mostrar Team Leaders en ranking", sub: "Si está desactivado, solo aparecen los agentes", val: showTeamLeaders, set: setShowTeamLeaders, key: "showTeamLeaders" },
                      { label: "Anonimizar equipo en ranking global", sub: 'Los agentes aparecen como "Agente #N" en el ranking público', val: anonymizeGlobal, set: setAnonymizeGlobal, key: "anonymizeGlobal" },
                    ].map(s => (
                      <div key={s.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "0.5px solid #f9fafb" }}>
                        <div style={{ flex: 1, paddingRight: 16 }}>
                          <div style={{ fontSize: 13, color: "#374151" }}>{s.label}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{s.sub}</div>
                        </div>
                        <div onClick={() => { const v = !s.val; s.set(v); saveSetting(s.key, v); }}
                          style={{ position: "relative", width: 40, height: 22, borderRadius: 11, background: s.val ? RED : "#e5e7eb", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
                          <div style={{ position: "absolute", top: 2, width: 18, height: 18, background: "#fff", borderRadius: "50%", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s", left: s.val ? "calc(100% - 20px)" : 2 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Cancelar suscripción */}
            {isPaid && !data.isVip && (
              <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                <button onClick={() => setShowCancel(!showCancel)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 20px", display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={14} color="#9ca3af" />
                  <span style={{ fontSize: 13, color: "#6b7280" }}>Cancelar suscripción</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>{showCancel ? "▲" : "▼"}</span>
                </button>
                {showCancel && (
                  <div style={{ borderTop: "0.5px solid #f3f4f6", padding: "16px 20px" }}>
                    <div style={{ background: "#FEF2F2", border: "0.5px solid #fecaca", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#991b1b", marginBottom: 4 }}>¿Seguro que querés cancelar?</div>
                      <div style={{ fontSize: 12, color: "#b91c1c", lineHeight: 1.6 }}>
                        Seguís con acceso hasta el {formatDate(data.nextPaymentDate)}. Después perdés acceso al historial y al Inmo Coach.
                      </div>
                    </div>
                    <input type="text" placeholder='Escribí "cancelar" para confirmar' value={cancelConfirm} onChange={e => setCancelConfirm(e.target.value)}
                      style={{ width: "100%", border: "0.5px solid #d1d5db", borderRadius: 10, padding: "9px 12px", fontSize: 13, outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
                    <button onClick={handleCancel} disabled={cancelConfirm.toLowerCase() !== "cancelar" || actionLoading}
                      style={{ width: "100%", background: cancelConfirm.toLowerCase() === "cancelar" ? "#dc2626" : "#e5e7eb", color: cancelConfirm.toLowerCase() === "cancelar" ? "#fff" : "#9ca3af", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: cancelConfirm.toLowerCase() === "cancelar" ? "pointer" : "not-allowed" }}>
                      {actionLoading ? "..." : "Cancelar suscripción"}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: 12, color: "#d1d5db", textAlign: "center" }}>
              Consultas de facturación: <span style={{ color: "#9ca3af" }}>hola@inmocoach.com.ar</span>
            </div>
          </div>

          {/* ── COL DERECHA — solo owners con plan pago ── */}
          {isPaid && data.isOwner && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Pricing widget */}
              <TeamsPricingWidget agentCount={data.agentCount} onInvite={() => document.getElementById("invite-input")?.focus()} />

              {/* Invitar agente */}
              <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <UserPlus size={15} color={RED} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>Invitar agente</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>{data.agentCount} activos</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input id="invite-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && invite()} placeholder="email@dominio.com"
                    style={{ flex: 1, border: "0.5px solid #d1d5db", borderRadius: 10, padding: "9px 12px", fontSize: 13, outline: "none", background: "#f9fafb" }} />
                  <button onClick={invite} disabled={inviting || !newEmail}
                    style={{ background: newEmail ? RED : "#e5e7eb", color: newEmail ? "#fff" : "#9ca3af", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 12, fontWeight: 500, cursor: newEmail ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 6 }}>
                    <Mail size={12} />
                    {inviting ? "Enviando..." : "Invitar"}
                  </button>
                </div>
                {inviteMsg && <div style={{ fontSize: 12, marginTop: 8, color: inviteMsg.includes("nviada") ? "#16a34a" : "#dc2626" }}>{inviteMsg}</div>}
              </div>

              {/* Usuarios activos */}
              {teamMembers.length > 0 && (
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
                    <Users size={13} color="#9ca3af" />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>{teamMembers.length} usuarios activos</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, background: "#fef2f2", color: RED, borderRadius: 6, padding: "2px 8px", fontWeight: 500 }}>
                      {teamMembers.length} seat{teamMembers.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div>
                    {teamMembers.map((a: any) => {
                      const role = a.team_role || a.teamRole;
                      return (
                        <div key={a.email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "0.5px solid #f9fafb" }}>
                          {a.avatar
                            ? <img src={a.avatar} style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0 }} />
                            : <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: "#9ca3af", flexShrink: 0 }}>
                                {(a.name || a.email)[0].toUpperCase()}
                              </div>}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name || a.email}</div>
                            {a.name && <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.email}</div>}
                          </div>
                          {role === "owner" ? (
                            <span style={{ fontSize: 11, fontWeight: 500, background: "#fef2f2", color: RED, borderRadius: 6, padding: "2px 8px", flexShrink: 0 }}>Broker</span>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                              {roleLoading === a.email ? <Loader2 size={12} style={{ color: "#9ca3af" }} className="animate-spin" /> : (
                                <select value={role} onChange={e => changeRole(a.email, e.target.value as "team_leader" | "member")}
                                  style={{ fontSize: 11, color: "#374151", background: "#f3f4f6", border: "none", borderRadius: 7, padding: "4px 8px", cursor: "pointer" }}>
                                  <option value="member">Agente</option>
                                  <option value="team_leader">Team Leader</option>
                                </select>
                              )}
                              <button onClick={() => removeAgent(a.email, a.name || a.email)} disabled={!!removeLoading}
                                style={{ fontSize: 11, color: "#9ca3af", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>
                                {removeLoading === a.email ? "..." : "Remover"}
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
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
                    <Clock size={13} color="#9ca3af" />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>Invitaciones pendientes</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>{pending.length}</span>
                  </div>
                  {pending.map((inv: any) => (
                    <div key={inv.token} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "0.5px solid #f9fafb", flexWrap: "wrap" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: "#9ca3af", flexShrink: 0 }}>
                        {inv.email[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>Pendiente · {new Date(inv.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={async () => { setResendLoading(inv.token); const r = await fetch("/api/teams/invitation", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action:"resend", token: inv.token}) }); const d = await r.json(); setResendLoading(null); setResendMsg(d.ok ? inv.token : null); setTimeout(() => setResendMsg(null), 3000); }}
                          disabled={resendLoading === inv.token}
                          style={{ fontSize: 11, color: "#374151", background: "#f3f4f6", border: "none", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>
                          {resendMsg === inv.token ? "✓ Enviado" : resendLoading === inv.token ? "..." : "Reenviar"}
                        </button>
                        <button onClick={async () => { await fetch("/api/teams/invitation", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action:"cancel", token: inv.token}) }); fetch("/api/teams/invite").then(r=>r.json()).then(d=>setPending(d.pending||[])); }}
                          style={{ fontSize: 11, color: "#dc2626", background: "#FEF2F2", border: "none", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Ex-agentes removidos */}
              {removedMembers.length > 0 && (
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #f3f4f6" }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>Agentes removidos</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Podés re-invitar cuando venza el bloqueo</div>
                  </div>
                  {removedMembers.map((m: any) => {
                    const blockedUntil = new Date(m.blocked_until);
                    const isBlocked = blockedUntil > new Date();
                    const daysLeft = Math.ceil((blockedUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={m.removed_email} style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "0.5px solid #f9fafb" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: "#374151" }}>{m.removed_email}</div>
                          <div style={{ fontSize: 11, color: isBlocked ? "#dc2626" : "#16a34a", marginTop: 2 }}>
                            {isBlocked ? `Bloqueado ${daysLeft} días más` : "Disponible para re-invitar"}
                          </div>
                        </div>
                        <button onClick={() => reinviteAgent(m.removed_email)} disabled={isBlocked || reinviteLoading === m.removed_email}
                          style={{ fontSize: 11, color: isBlocked ? "#9ca3af" : "#374151", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 7, padding: "5px 12px", cursor: isBlocked ? "not-allowed" : "pointer" }}>
                          {reinviteLoading === m.removed_email ? "Enviando..." : "Re-invitar"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal volver con equipo */}
      {retornarModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, maxWidth: 440, width: "100%", padding: 28 }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: "#111827", fontFamily: "Georgia, serif" }}>Bienvenido de vuelta</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>¿Cómo querés continuar?</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { icon: "👥", title: "Retomar mi equipo", desc: `Seguís como broker con tu equipo. Se cobra por ${data?.agentCount || 1} agentes.`, action: retornarConEquipo },
                { icon: "👤", title: "Plan individual", desc: "Solo para vos. Tu equipo anterior se eliminará.", action: retornarIndividual },
              ].map(opt => (
                <div key={opt.title} onClick={opt.action} style={{ border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 16, cursor: "pointer", display: "flex", gap: 12 }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{opt.title}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            {retornarLoading && <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 16 }}>Procesando...</div>}
          </div>
        </div>
      )}

      {/* Modal confirmar remoción */}
      {removeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, maxWidth: 380, width: "100%", padding: 24 }}>
            <div style={{ fontSize: 24, textAlign: "center", marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: "#111827", textAlign: "center", marginBottom: 12 }}>¿Remover a {removeModal.name}?</div>
            <div style={{ background: "#FFFBEB", border: "0.5px solid #fcd34d", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
              • Tendrá 7 días de acceso gratuito, luego deberá contratar plan individual.<br />
              • No podrás volver a invitarlo por 60 días.<br />
              • El precio baja en el próximo ciclo de facturación.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setRemoveModal(null)} style={{ flex: 1, background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: "10px 0", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={confirmRemove} disabled={removeLoading === removeModal.email}
                style={{ flex: 1, background: RED, color: "#fff", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                {removeLoading === removeModal.email ? "Removiendo..." : "Sí, remover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
