import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import AppLayout from "../../components/AppLayout";
import { Loader2 } from "lucide-react";

const RED = "#aa0000";

function Toggle({ val, onChange }: { val: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!val)} style={{
      position: "relative", width: 38, height: 21, borderRadius: 11,
      background: val ? RED : "#e5e7eb", cursor: "pointer", flexShrink: 0, transition: "background 0.2s",
    }}>
      <div style={{
        position: "absolute", top: 2, width: 17, height: 17, background: "#fff",
        borderRadius: "50%", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
        left: val ? "calc(100% - 19px)" : 2,
      }} />
    </div>
  );
}

interface MailTemplate {
  key: string;
  label: string;
  emoji: string;
  description: string;
  when: string;
  category: "celebration" | "loyalty";
  subject: string;
  body: string;
  enabled: boolean;
  isCustom: boolean;
}

export default function MailsAutomaticosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<MailTemplate | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    
    const load = async () => {
      try {
        // Verificar que sea owner o team_leader
        const subResp = await fetch("/api/subscription");
        const subData = await subResp.json();
        const role = subData.subscription?.teamRole;
        
        if (role !== "owner" && role !== "team_leader") {
          router.replace("/");
          return;
        }
        
        const mailsResp = await fetch("/api/auto-mails");
        const mailsData = mailsResp.ok ? await mailsResp.json() : null;
        
        if (mailsData?.templates) {
          setTemplates(mailsData.templates);
        }
        setLoading(false);
      } catch {
        setLoading(false);
      }
    };
    
    load();
  }, [status, router]);

  const openEdit = (t: MailTemplate) => {
    setEditSubject(t.subject);
    setEditBody(t.body);
    setEditModal(t);
  };

  const saveEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    await fetch("/api/auto-mails", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: editModal.key, subject: editSubject, body: editBody, enabled: editModal.enabled }),
    });
    setTemplates(prev => prev.map(t => t.key === editModal.key ? { ...t, subject: editSubject, body: editBody, isCustom: true } : t));
    setSaving(false);
    setEditModal(null);
  };

  const toggleEnabled = async (key: string, enabled: boolean) => {
    setTogglingKey(key);
    const t = templates.find(t => t.key === key);
    if (!t) return;
    await fetch("/api/auto-mails", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, subject: t.subject, body: t.body, enabled }),
    });
    setTemplates(prev => prev.map(t => t.key === key ? { ...t, enabled } : t));
    setTogglingKey(null);
  };

  const resetToDefault = async () => {
    if (!editModal) return;
    setSaving(true);
    // Traer el default del servidor
    const res = await fetch("/api/auto-mails");
    if (res.ok) {
      // Eliminar la fila custom — PUT con flag reset
      await fetch("/api/auto-mails", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: editModal.key, subject: null, body: null, enabled: editModal.enabled, reset: true }),
      });
      const fresh = await fetch("/api/auto-mails").then(r => r.json());
      if (fresh?.templates) setTemplates(fresh.templates);
    }
    setSaving(false);
    setEditModal(null);
  };

  if (status === "loading" || loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 size={24} className="animate-spin" style={{ color: RED }} /></div>;
  }

  const celebration = templates.filter(t => t.category === "celebration");
  const loyalty = templates.filter(t => t.category === "loyalty");

  const VARS_HINT = "Variables: {nombre}, {inmobiliaria}, {años}, {plural}, {meses}";

  return (
    <AppLayout greeting="Mails automáticos">
      <Head><title>Mails automáticos — InmoCoach</title></Head>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 0 40px" }}>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24, lineHeight: 1.6 }}>
          Estos mails se envían automáticamente en nombre de tu inmobiliaria. Podés activar, desactivar y personalizar el contenido de cada uno.
        </p>

        {/* ── CELEBRACIÓN ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Celebración
          </div>
          <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
            {celebration.map((t, i) => (
              <MailRow
                key={t.key} t={t} isLast={i === celebration.length - 1}
                toggling={togglingKey === t.key}
                onToggle={v => toggleEnabled(t.key, v)}
                onEdit={() => openEdit(t)}
              />
            ))}
          </div>
        </div>

        {/* ── FIDELIZACIÓN ── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Fidelización
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10, lineHeight: 1.5 }}>
            Se envían automáticamente al agente según los días transcurridos desde su fecha de ingreso a la empresa.
          </div>
          <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
            {loyalty.map((t, i) => (
              <MailRow
                key={t.key} t={t} isLast={i === loyalty.length - 1}
                toggling={togglingKey === t.key}
                onToggle={v => toggleEnabled(t.key, v)}
                onEdit={() => openEdit(t)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── MODAL EDICIÓN ── */}
      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            {/* Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{editModal.emoji} {editModal.label}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>{editModal.when}</div>
              </div>
              <button onClick={() => setEditModal(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9ca3af", lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>

            <div style={{ padding: "20px 24px" }}>
              {/* Variables hint */}
              <div style={{ background: "#f9fafb", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#6b7280", marginBottom: 18, lineHeight: 1.6 }}>
                {VARS_HINT}
              </div>

              {/* Asunto */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Asunto</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#111827", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* Cuerpo */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Contenido del mail</label>
                <textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  rows={14}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#374151", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.7, fontFamily: "inherit" }}
                />
              </div>

              {/* Acciones */}
              <div style={{ display: "flex", gap: 8 }}>
                {editModal.isCustom && (
                  <button onClick={resetToDefault} disabled={saving}
                    style={{ flex: 1, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 0", fontSize: 12, color: "#6b7280", cursor: saving ? "default" : "pointer" }}>
                    Restaurar original
                  </button>
                )}
                <button onClick={saveEdit} disabled={saving}
                  style={{ flex: 2, background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function MailRow({ t, isLast, toggling, onToggle, onEdit }: {
  t: MailTemplate; isLast: boolean;
  toggling: boolean;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", borderBottom: isLast ? "none" : "0.5px solid #f3f4f6", opacity: t.enabled ? 1 : 0.5 }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{t.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{t.label}</div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{t.when}</div>
      </div>
      {t.isCustom && (
        <span style={{ fontSize: 10, background: "#f0fdf4", color: "#16a34a", borderRadius: 5, padding: "2px 7px", fontWeight: 500, flexShrink: 0 }}>
          personalizado
        </span>
      )}
      <button onClick={onEdit}
        style={{ fontSize: 11, color: "#6b7280", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: 7, padding: "4px 12px", cursor: "pointer", flexShrink: 0 }}>
        Editar
      </button>
      {toggling
        ? <Loader2 size={16} className="animate-spin" style={{ color: "#9ca3af" }} />
        : <Toggle val={t.enabled} onChange={onToggle} />
      }
    </div>
  );
}
