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
  const [tokkoAgents, setTokkoAgents] = useState<{ name: string; email: string; picture: string | null; branch_name: string | null }[]>([]);
  const [invitingEmails, setInvitingEmails] = useState<Set<string>>(new Set());
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

  // Mi cumpleaños
  const [bdDay, setBdDay] = useState("");
  const [bdMonth, setBdMonth] = useState("");
  const [bdYear, setBdYear] = useState("");
  const [bdSaving, setBdSaving] = useState(false);
  const [bdMsg, setBdMsg] = useState("");
  // Mi aniversario
  const [anDay, setAnDay] = useState("");
  const [anMonth, setAnMonth] = useState("");
  const [anYear, setAnYear] = useState("");
  const [anSaving, setAnSaving] = useState(false);
  const [anMsg, setAnMsg] = useState("");
  // Mapa de cumpleaños/aniversarios del equipo (para broker y team leader)
  const [memberDates, setMemberDates] = useState<Record<string, { birthday: string|null; work_anniversary: string|null }>>({});
  const [memberSaving, setMemberSaving] = useState<string|null>(null);
  // Modal de fechas de un miembro
  const [dateModal, setDateModal] = useState<{ email: string; name: string } | null>(null);
  const [dmBdDay, setDmBdDay] = useState(""); const [dmBdMonth, setDmBdMonth] = useState(""); const [dmBdYear, setDmBdYear] = useState("");
  const [dmAnDay, setDmAnDay] = useState(""); const [dmAnMonth, setDmAnMonth] = useState(""); const [dmAnYear, setDmAnYear] = useState("");
  const [dmSaving, setDmSaving] = useState(false); const [dmMsg, setDmMsg] = useState("");
  // Templates de mails
  const [tmplModal, setTmplModal] = useState(false);
  const [tmplBdAgent, setTmplBdAgent] = useState("");
  const [tmplBdTeam, setTmplBdTeam] = useState("");
  const [tmplAnAgent, setTmplAnAgent] = useState("");
  const [tmplAnTeam, setTmplAnTeam] = useState("");
  const [tmplLoading, setTmplLoading] = useState(false);
  const [tmplSaving, setTmplSaving] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [showTeamLeaders, setShowTeamLeaders] = useState(true);
  const [showBroker, setShowBroker] = useState(true);
  const [anonymizeGlobal, setAnonymizeGlobal] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);

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
    fetch("/api/teams/tokko-agents").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.agents) setTokkoAgents(d.agents);
    });
    // Cargar cumpleaños y aniversarios del equipo
    fetch("/api/teams/birthday").then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.members) return;
      const me = d.members.find((m: any) => m.email === session?.user?.email);
      if (me?.birthday) {
        const b = new Date(me.birthday + "T12:00:00");
        setBdDay(String(b.getDate()).padStart(2, "0"));
        setBdMonth(String(b.getMonth() + 1).padStart(2, "0"));
        setBdYear(b.getFullYear() === 1900 ? "" : String(b.getFullYear()));
      }
      if (me?.work_anniversary) {
        const a = new Date(me.work_anniversary + "T12:00:00");
        setAnDay(String(a.getDate()).padStart(2, "0"));
        setAnMonth(String(a.getMonth() + 1).padStart(2, "0"));
        setAnYear(a.getFullYear() === 1900 ? "" : String(a.getFullYear()));
      }
      // Mapa para la tabla del equipo
      const map: Record<string, { birthday: string|null; work_anniversary: string|null }> = {};
      for (const m of d.members) {
        map[m.email] = { birthday: m.birthday || null, work_anniversary: m.work_anniversary || null };
      }
      setMemberDates(map);
    });
  }, [status]);


  const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  function buildDate(day: string, month: string, year: string): string | null {
    if (!day || !month) return null;
    const y = year && year.length === 4 ? year : "1900";
    return `${y}-${month.padStart(2,"0")}-${day.padStart(2,"0")}`;
  }

  function parseDateFields(dateStr: string | null): { day: string; month: string; year: string } {
    if (!dateStr) return { day: "", month: "", year: "" };
    const d = new Date(dateStr + "T12:00:00");
    return {
      day: String(d.getDate()).padStart(2, "0"),
      month: String(d.getMonth() + 1).padStart(2, "0"),
      year: d.getFullYear() === 1900 ? "" : String(d.getFullYear()),
    };
  }

  const saveMyBirthday = async () => {
    if (!bdDay || !bdMonth) { setBdMsg("Completá el día y el mes."); return; }
    setBdSaving(true);
    setBdMsg("");
    const year = bdYear && bdYear.length === 4 ? bdYear : "1900";
    const birthday = `${year}-${bdMonth.padStart(2,"0")}-${bdDay.padStart(2,"0")}`;
    try {
      const res = await fetch("/api/teams/birthday", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentEmail: session?.user?.email, birthday }),
      });
      if (res.ok) setBdMsg("✓ Cumpleaños guardado");
      else setBdMsg("Error al guardar");
    } catch { setBdMsg("Error al guardar"); }
    setBdSaving(false);
  };

  const openDateModal = (email: string, name: string) => {
    const dates = memberDates[email] || { birthday: null, work_anniversary: null };
    const bd = parseDateFields(dates.birthday);
    const an = parseDateFields(dates.work_anniversary);
    setDmBdDay(bd.day); setDmBdMonth(bd.month); setDmBdYear(bd.year);
    setDmAnDay(an.day); setDmAnMonth(an.month); setDmAnYear(an.year);
    setDmMsg("");
    setDateModal({ email, name });
  };

  const saveDateModal = async () => {
    if (!dateModal) return;
    setDmSaving(true); setDmMsg("");
    const birthday = buildDate(dmBdDay, dmBdMonth, dmBdYear);
    const work_anniversary = buildDate(dmAnDay, dmAnMonth, dmAnYear);
    try {
      await fetch("/api/teams/birthday", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentEmail: dateModal.email, birthday, work_anniversary }),
      });
      setMemberDates(prev => ({ ...prev, [dateModal.email]: { birthday, work_anniversary } }));
      setDmMsg("✓ Guardado");
      setTimeout(() => setDateModal(null), 800);
    } catch { setDmMsg("Error al guardar"); }
    setDmSaving(false);
  };

  const saveMyAnniversary = async () => {
    if (!anDay || !anMonth) { setAnMsg("Completá el día y el mes."); return; }
    setAnSaving(true); setAnMsg("");
    const work_anniversary = buildDate(anDay, anMonth, anYear);
    try {
      const res = await fetch("/api/teams/birthday", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentEmail: session?.user?.email, work_anniversary }),
      });
      if (res.ok) setAnMsg("✓ Aniversario guardado");
      else setAnMsg("Error al guardar");
    } catch { setAnMsg("Error al guardar"); }
    setAnSaving(false);
  };

  const saveMemberDate = async (email: string, field: "birthday" | "work_anniversary", value: string | null) => {
    setMemberSaving(email + field);
    try {
      await fetch("/api/teams/birthday", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentEmail: email, [field]: value }),
      });
      setMemberDates(prev => ({
        ...prev,
        [email]: { ...prev[email], [field]: value },
      }));
    } catch {}
    setMemberSaving(null);
  };

  const loadTemplates = async () => {
    setTmplLoading(true);
    try {
      const res = await fetch("/api/teams/birthday-templates");
      if (res.ok) {
        const d = await res.json();
        setTmplBdAgent(d.birthdayMsgAgent || "");
        setTmplBdTeam(d.birthdayMsgTeam || "");
        setTmplAnAgent(d.anniversaryMsgAgent || "");
        setTmplAnTeam(d.anniversaryMsgTeam || "");
      }
    } catch {}
    setTmplLoading(false);
  };

  const saveTemplates = async () => {
    setTmplSaving(true);
    try {
      const res = await fetch("/api/teams/birthday-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birthdayMsgAgent: tmplBdAgent,
          birthdayMsgTeam: tmplBdTeam,
          anniversaryMsgAgent: tmplAnAgent,
          anniversaryMsgTeam: tmplAnTeam,
        }),
      });
      if (res.ok) setTmplModal(false);
    } catch {}
    setTmplSaving(false);
  };

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
    if (d.ok) {
      setInviteMsg(`Invitación enviada a ${newEmail}`); setNewEmail("");
      fetch("/api/teams/invite").then(r=>r.json()).then(d=>setPending(d.pending||[]));
      fetch("/api/teams/tokko-agents").then(r=>r.ok?r.json():null).then(d=>{ if(d?.agents) setTokkoAgents(d.agents); });
    }
    else setInviteMsg(d.error || "Error");
    setInviting(false);
  };

  const inviteOne = async (email: string) => {
    setInvitingEmails(prev => new Set([...Array.from(prev), email]));
    const res = await fetch("/api/teams/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const d = await res.json();
    if (d.ok) {
      setTokkoAgents(prev => prev.filter(a => a.email.toLowerCase() !== email.toLowerCase()));
      fetch("/api/teams/invite").then(r=>r.json()).then(d=>setPending(d.pending||[]));
    } else {
      alert(d.error || "Error al invitar");
    }
    setInvitingEmails(prev => { const s = new Set(prev); s.delete(email); return s; });
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

  if (!data) return null;

  const isPaid = (data.plan !== "free" && data.status === "active") || data.isVip === true;

  return (
    <AppLayout>
      <Head><title>Mi cuenta — InmoCoach</title></Head>

      <style>{`
        .mc-agents { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 900px) { .mc-agents { grid-template-columns: 1fr; } }
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

        {/* ── CUMPLEAÑOS Y ANIVERSARIOS ── */}
        <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
          {/* Header */}
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🎂</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Cumpleaños y aniversarios</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>Tu equipo lo verá en el dashboard 15 días antes</div>
              </div>
            </div>
            {(data.isOwner || data.teamRole === "team_leader") && (
              <button onClick={() => { setTmplModal(true); loadTemplates(); }}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 7, padding: "5px 10px", fontSize: 11, color: "#6b7280", cursor: "pointer" }}>
                ✉️ <span>Editar mails</span>
              </button>
            )}
          </div>

          <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #f9fafb" }}>
            {/* Mi cumpleaños */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>🎂 Mi cumpleaños</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 60px", minWidth: 60 }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Día</div>
                  <select value={bdDay} onChange={e => setBdDay(e.target.value)}
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: bdDay ? "#111827" : "#9ca3af", outline: "none", background: "#fff" }}>
                    <option value="">--</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: "2 1 100px", minWidth: 100 }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Mes</div>
                  <select value={bdMonth} onChange={e => setBdMonth(e.target.value)}
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: bdMonth ? "#111827" : "#9ca3af", outline: "none", background: "#fff" }}>
                    <option value="">--</option>
                    {MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
                  </select>
                </div>
                <div style={{ flex: "1 1 70px", minWidth: 70 }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Año</div>
                  <input type="number" placeholder="1990" value={bdYear} onChange={e => setBdYear(e.target.value)} min={1920} max={2010}
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#111827", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: "1 1 70px", minWidth: 70, display: "flex", alignItems: "flex-end" }}>
                  <button onClick={saveMyBirthday} disabled={bdSaving}
                    style={{ width: "100%", background: "#111827", color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 13, fontWeight: 500, cursor: bdSaving ? "default" : "pointer", opacity: bdSaving ? 0.7 : 1 }}>
                    {bdSaving ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
              {bdMsg && <div style={{ fontSize: 12, marginTop: 6, color: bdMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>{bdMsg}</div>}
            </div>

            {/* Mi aniversario */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>🏡 Mi aniversario en la empresa</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 60px", minWidth: 60 }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Día</div>
                  <select value={anDay} onChange={e => setAnDay(e.target.value)}
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: anDay ? "#111827" : "#9ca3af", outline: "none", background: "#fff" }}>
                    <option value="">--</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: "2 1 100px", minWidth: 100 }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Mes</div>
                  <select value={anMonth} onChange={e => setAnMonth(e.target.value)}
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: anMonth ? "#111827" : "#9ca3af", outline: "none", background: "#fff" }}>
                    <option value="">--</option>
                    {MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
                  </select>
                </div>
                <div style={{ flex: "1 1 70px", minWidth: 70 }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Año</div>
                  <input type="number" placeholder="2020" value={anYear} onChange={e => setAnYear(e.target.value)} min={1990} max={2030}
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#111827", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: "1 1 70px", minWidth: 70, display: "flex", alignItems: "flex-end" }}>
                  <button onClick={saveMyAnniversary} disabled={anSaving}
                    style={{ width: "100%", background: "#111827", color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 13, fontWeight: 500, cursor: anSaving ? "default" : "pointer", opacity: anSaving ? 0.7 : 1 }}>
                    {anSaving ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
              {anMsg && <div style={{ fontSize: 12, marginTop: 6, color: anMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>{anMsg}</div>}
            </div>
          </div>

        </div>

        {/* ── MODAL TEMPLATES ── */}
        {tmplModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>✉️ Mensajes automáticos</div>
                <button onClick={() => setTmplModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#9ca3af" }}>×</button>
              </div>
              {tmplLoading ? (
                <div style={{ textAlign: "center", padding: 32, color: "#9ca3af" }}>Cargando...</div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 16 }}>Variables disponibles: {"{nombre}"}, {"{inmobiliaria}"}, {"{años}"}, {"{plural}"}</div>
                  {[
                    { label: "🎂 Cumpleaños — mail al festejado", val: tmplBdAgent, set: setTmplBdAgent },
                    { label: "🎂 Cumpleaños — mail al equipo (día anterior)", val: tmplBdTeam, set: setTmplBdTeam },
                    { label: "🏡 Aniversario — mail al festejado", val: tmplAnAgent, set: setTmplAnAgent },
                    { label: "🏡 Aniversario — mail al equipo (día anterior)", val: tmplAnTeam, set: setTmplAnTeam },
                  ].map(({ label, val, set }) => (
                    <div key={label} style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{label}</label>
                      <textarea value={val} onChange={e => set(e.target.value)} rows={4}
                        style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#374151", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
                    </div>
                  ))}
                  <button onClick={saveTemplates} disabled={tmplSaving}
                    style={{ width: "100%", background: "#111827", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: tmplSaving ? "default" : "pointer", opacity: tmplSaving ? 0.7 : 1 }}>
                    {tmplSaving ? "Guardando..." : "Guardar todos los mensajes"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── PLAN FULL WIDTH ── */}
        <div style={{ background: "#111827", borderRadius: 14, padding: "20px 24px", marginBottom: 16 }}>
          {data.isVip && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(251,191,36,0.15)", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
              <span style={{ fontSize: 16 }}>👑</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#fcd34d" }}>Cuenta VIP — acceso permanente sin cobro</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(170,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {data.isOwner ? <Users size={22} color="#fff" /> : <User size={22} color="#fff" />}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 500, color: "#fff", fontFamily: "Georgia, serif" }}>
                  {data.plan === "free" ? "Prueba gratuita" : data.isOwner ? `Equipo · ${data.tier}` : "Individual"}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                  {data.plan === "free" ? "7 días gratis" : data.isOwner ? `${data.agentCount} agente${data.agentCount !== 1 ? "s" : ""}` : "1 agente"}
                  {isPaid && data.discountPct > 0 && <span style={{ marginLeft: 8, color: "#4ade80" }}>· -{data.discountPct}% descuento por volumen</span>}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 36, fontWeight: 500, fontFamily: "Georgia, serif", color: isPaid ? RED : "#6b7280", lineHeight: 1 }}>
                {isPaid ? formatPriceARS(data.total) : "$0"}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                /mes{data.nextPaymentDate && ` · próximo cobro ${formatDate(data.nextPaymentDate)}`}
              </div>
            </div>
          </div>
          {!isPaid && (
            <button onClick={() => router.push("/pricing")}
              style={{ marginTop: 16, background: RED, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              Ver planes →
            </button>
          )}
        </div>

        {/* Pricing widget solo owners */}
        {isPaid && data.isOwner && (
          <div style={{ marginBottom: 16 }}>
            <TeamsPricingWidget agentCount={data.agentCount} onInvite={() => document.getElementById("invite-input")?.focus()} />
          </div>
        )}

        {/* ── GRID AGENTES ── */}
        {isPaid && data.isOwner && (
          <div className="mc-agents" style={{ marginBottom: 16 }}>

            {/* COL IZQ — Invitar + Tokko */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
              {/* Input email */}
              <div style={{ padding: "16px 16px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <UserPlus size={14} color={RED} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>Invitar agente</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>{data.agentCount} activos</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input id="invite-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && invite()} placeholder="email@dominio.com"
                    style={{ flex: 1, border: "0.5px solid #d1d5db", borderRadius: 10, padding: "8px 12px", fontSize: 13, outline: "none", background: "#f9fafb" }} />
                  <button onClick={invite} disabled={inviting || !newEmail}
                    style={{ background: newEmail ? RED : "#e5e7eb", color: newEmail ? "#fff" : "#9ca3af", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 500, cursor: newEmail ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 5 }}>
                    <Mail size={12} />{inviting ? "Enviando..." : "Invitar"}
                  </button>
                </div>
                {inviteMsg && <div style={{ fontSize: 12, marginTop: 8, color: inviteMsg.includes("nviada") ? "#16a34a" : "#dc2626" }}>{inviteMsg}</div>}
              </div>

              {/* Sugerencias Tokko */}
              {tokkoAgents.length > 0 && (
                <>
                  <div style={{ padding: "8px 16px", background: "#f9fafb", borderTop: "0.5px solid #f3f4f6", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#374151" }}>🏠 Agentes de Tokko sin invitar</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>{tokkoAgents.length} disponibles</span>
                  </div>
                  {tokkoAgents.map(agent => (
                    <div key={agent.email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "0.5px solid #f9fafb" }}>
                      {agent.picture
                        ? <img src={agent.picture} alt="" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }} />
                        : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: "#9ca3af", flexShrink: 0 }}>
                            {(agent.name || agent.email)[0].toUpperCase()}
                          </div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.name || agent.email}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.email}</div>
                      </div>
                      <button onClick={() => inviteOne(agent.email)} disabled={invitingEmails.has(agent.email)}
                        style={{ background: invitingEmails.has(agent.email) ? "#e5e7eb" : RED, color: invitingEmails.has(agent.email) ? "#9ca3af" : "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>
                        {invitingEmails.has(agent.email) ? "Enviando..." : "Invitar"}
                      </button>
                    </div>
                  ))}
                </>
              )}

              {/* Invitaciones pendientes */}
              {pending.length > 0 && (
                <>
                  <div style={{ padding: "8px 16px", background: "#f9fafb", borderTop: "0.5px solid #f3f4f6", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#374151" }}>⏳ Pendientes de aceptar</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>{pending.length}</span>
                  </div>
                  {pending.map((inv: any) => (
                    <div key={inv.token} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "0.5px solid #f9fafb", flexWrap: "wrap" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: "#9ca3af", flexShrink: 0 }}>
                        {inv.email[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{new Date(inv.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={async () => { setResendLoading(inv.token); const r = await fetch("/api/teams/invitation", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action:"resend", token: inv.token}) }); const d = await r.json(); setResendLoading(null); setResendMsg(d.ok ? inv.token : null); setTimeout(() => setResendMsg(null), 3000); }}
                          disabled={resendLoading === inv.token}
                          style={{ fontSize: 11, color: "#374151", background: "#f3f4f6", border: "none", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>
                          {resendMsg === inv.token ? "✓" : resendLoading === inv.token ? "..." : "Reenviar"}
                        </button>
                        <button onClick={async () => { await fetch("/api/teams/invitation", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action:"cancel", token: inv.token}) }); fetch("/api/teams/invite").then(r=>r.json()).then(d=>setPending(d.pending||[])); }}
                          style={{ fontSize: 11, color: "#dc2626", background: "#FEF2F2", border: "none", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* COL DER — Usuarios activos */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={13} color="#9ca3af" />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>Usuarios activos</span>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 500, background: "#fef2f2", color: RED, borderRadius: 6, padding: "2px 8px" }}>Broker</span>
                          {(data.isOwner || data.teamRole === "team_leader") && (
                            <button onClick={() => openDateModal(a.email, a.name || a.email)}
                              title={memberDates[a.email]?.birthday || memberDates[a.email]?.work_anniversary ? "Editar fechas" : "Agregar cumpleaños / aniversario"}
                              style={{ fontSize: 14, background: "none", border: "none", cursor: "pointer", opacity: memberDates[a.email]?.birthday || memberDates[a.email]?.work_anniversary ? 1 : 0.35, padding: "0 2px" }}>
                              🎂
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          {roleLoading === a.email ? <Loader2 size={12} style={{ color: "#9ca3af" }} className="animate-spin" /> : (
                            <select value={role} onChange={e => changeRole(a.email, e.target.value as "team_leader" | "member")}
                              style={{ fontSize: 11, color: "#374151", background: "#f3f4f6", border: "none", borderRadius: 7, padding: "4px 8px", cursor: "pointer" }}>
                              <option value="member">Agente</option>
                              <option value="team_leader">Team Leader</option>
                            </select>
                          )}
                          <button onClick={() => openDateModal(a.email, a.name || a.email)}
                            title={memberDates[a.email]?.birthday || memberDates[a.email]?.work_anniversary ? "Editar fechas" : "Agregar cumpleaños / aniversario"}
                            style={{ fontSize: 14, background: "none", border: "none", cursor: "pointer", opacity: memberDates[a.email]?.birthday || memberDates[a.email]?.work_anniversary ? 1 : 0.35, padding: "0 2px" }}>
                            🎂
                          </button>
                          <button onClick={() => removeAgent(a.email, a.name || a.email)} disabled={!!removeLoading}
                            style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>
                            {removeLoading === a.email ? "..." : "Remover"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Ex-agentes */}
              {removedMembers.length > 0 && (
                <>
                  <div style={{ padding: "8px 16px", background: "#f9fafb", borderTop: "0.5px solid #f3f4f6", borderBottom: "0.5px solid #f3f4f6" }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#374151" }}>Removidos</span>
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
                            {isBlocked ? `Bloqueado ${daysLeft}d más` : "Disponible para re-invitar"}
                          </div>
                        </div>
                        <button onClick={() => reinviteAgent(m.removed_email)} disabled={isBlocked || reinviteLoading === m.removed_email}
                          style={{ fontSize: 11, color: isBlocked ? "#9ca3af" : "#374151", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 7, padding: "5px 10px", cursor: isBlocked ? "not-allowed" : "pointer" }}>
                          {reinviteLoading === m.removed_email ? "..." : "Re-invitar"}
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {/* Cancelar + billing */}
        {isPaid && !data.isVip && (
          <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
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
      {/* ── MODAL FECHAS MIEMBRO ── */}
      {dateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Fechas de {dateModal.name.split(" ")[0]}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Cumpleaños y aniversario</div>
              </div>
              <button onClick={() => setDateModal(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9ca3af", lineHeight: 1 }}>×</button>
            </div>

            {/* Cumpleaños */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>🎂 Cumpleaños</div>
              <div style={{ display: "flex", gap: 6 }}>
                <select value={dmBdDay} onChange={e => setDmBdDay(e.target.value)}
                  style={{ flex: "0 0 58px", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 6px", fontSize: 13, color: dmBdDay ? "#111827" : "#9ca3af", outline: "none", background: "#fff" }}>
                  <option value="">Día</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={String(d).padStart(2,"0")}>{d}</option>)}
                </select>
                <select value={dmBdMonth} onChange={e => setDmBdMonth(e.target.value)}
                  style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 6px", fontSize: 13, color: dmBdMonth ? "#111827" : "#9ca3af", outline: "none", background: "#fff" }}>
                  <option value="">Mes</option>
                  {MONTHS.map((m, i) => <option key={i} value={String(i+1).padStart(2,"0")}>{m}</option>)}
                </select>
                <input type="number" placeholder="Año" value={dmBdYear} onChange={e => setDmBdYear(e.target.value)} min={1920} max={2010}
                  style={{ flex: "0 0 70px", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 8px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Aniversario */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>🏡 Aniversario en la empresa</div>
              <div style={{ display: "flex", gap: 6 }}>
                <select value={dmAnDay} onChange={e => setDmAnDay(e.target.value)}
                  style={{ flex: "0 0 58px", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 6px", fontSize: 13, color: dmAnDay ? "#111827" : "#9ca3af", outline: "none", background: "#fff" }}>
                  <option value="">Día</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={String(d).padStart(2,"0")}>{d}</option>)}
                </select>
                <select value={dmAnMonth} onChange={e => setDmAnMonth(e.target.value)}
                  style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 6px", fontSize: 13, color: dmAnMonth ? "#111827" : "#9ca3af", outline: "none", background: "#fff" }}>
                  <option value="">Mes</option>
                  {MONTHS.map((m, i) => <option key={i} value={String(i+1).padStart(2,"0")}>{m}</option>)}
                </select>
                <input type="number" placeholder="Año" value={dmAnYear} onChange={e => setDmAnYear(e.target.value)} min={1990} max={2035}
                  style={{ flex: "0 0 70px", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 8px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>

            {dmMsg && <div style={{ fontSize: 12, marginBottom: 12, color: dmMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>{dmMsg}</div>}
            <button onClick={saveDateModal} disabled={dmSaving}
              style={{ width: "100%", background: "#111827", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: dmSaving ? "default" : "pointer", opacity: dmSaving ? 0.7 : 1 }}>
              {dmSaving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
