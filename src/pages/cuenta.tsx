import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ArrowLeft, Users, User, CreditCard, AlertTriangle, Loader2, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";
import { VOLUME_TIERS, calcTeamsTotal, pricePerAgent, formatPriceARS, agentsToNextTier, getNextTier } from "../lib/pricing";

const RED = "#aa0000";
const BASE_PRICE = 10500;

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
  const [agentSlider, setAgentSlider] = useState(1);
  const [showSlider, setShowSlider] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/cuenta")
      .then(r => r.json())
      .then(d => { setData(d); setAgentSlider(d.agentCount || 1); })
      .finally(() => setLoading(false));
  }, [status]);

  const handleChangeAgents = async () => {
    setActionLoading(true);
    const res = await fetch("/api/cuenta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_agents", agentCount: agentSlider }),
    });
    const d = await res.json();
    setActionLoading(false);
    if (d.checkoutUrl) window.location.href = d.checkoutUrl;
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

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin" style={{ color: RED }} />
      </div>
    );
  }

  if (!data) return null;

  const isPaid = (data.plan !== "free" && data.status === "active") || data.isVip === true;
  const newTotal = calcTeamsTotal(BASE_PRICE, agentSlider);
  const newPerAgent = pricePerAgent(BASE_PRICE, agentSlider);
  const sliderChanged = agentSlider !== data.agentCount;
  const toNext = agentsToNextTier(agentSlider);
  const nextTier = getNextTier(agentSlider);

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

        {/* Cambiar agentes — solo owners pagos */}
        {isPaid && data.isOwner && !data.isVip && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <button onClick={() => setShowSlider(!showSlider)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <Users size={15} style={{ color: RED }} />
                <span className="font-bold text-sm text-gray-800">Cambiar cantidad de agentes</span>
              </div>
              {showSlider ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
            </button>

            {showSlider && (
              <div className="px-5 pb-5 border-t border-gray-50">
                <div className="pt-4 space-y-4">
                  <div className="flex items-center gap-4">
                    <input type="range" min={1} max={30} value={agentSlider}
                      onChange={e => setAgentSlider(Number(e.target.value))}
                      className="flex-1 accent-red-700" />
                    <div className="w-16 text-center">
                      <span className="font-black text-2xl" style={{ fontFamily: "Georgia, serif", color: RED }}>{agentSlider}</span>
                      <div className="text-xs text-gray-400">agentes</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="text-xs text-gray-400 mb-1">Total nuevo</div>
                      <div className="font-black text-xl" style={{ fontFamily: "Georgia, serif", color: RED }}>{formatPriceARS(newTotal)}</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="text-xs text-gray-400 mb-1">Por agente</div>
                      <div className="font-black text-xl" style={{ fontFamily: "Georgia, serif", color: RED }}>{formatPriceARS(newPerAgent)}</div>
                    </div>
                  </div>

                  {nextTier && toNext === 1 && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-xs font-bold text-amber-700">
                      🔥 Con 1 agente más todos bajan a {formatPriceARS(pricePerAgent(BASE_PRICE, nextTier.minAgents))}/agente
                    </div>
                  )}

                  {sliderChanged && (
                    <button onClick={handleChangeAgents} disabled={actionLoading}
                      className="w-full py-3 rounded-xl font-black text-white text-sm hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ background: RED }}>
                      {actionLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                      {agentSlider > data.agentCount ? `Sumar agentes → ${formatPriceARS(newTotal)}/mes` : `Reducir a ${agentSlider} agentes → ${formatPriceARS(newTotal)}/mes`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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
