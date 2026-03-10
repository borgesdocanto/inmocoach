import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { VOLUME_TIERS, calcTeamsTotal, pricePerAgent, formatPriceARS, agentsToNextTier, getNextTier } from "../lib/pricing";
import { ArrowLeft, Users, Check, Loader2 } from "lucide-react";

const RED = "#aa0000";
const BASE_PRICE = 10500;

function AgentSimulator({ onCheckout }: { onCheckout: (count: number) => void }) {
  const [count, setCount] = useState(5);
  const total = calcTeamsTotal(BASE_PRICE, count);
  const perAgent = pricePerAgent(BASE_PRICE, count);
  const toNext = agentsToNextTier(count);
  const nextTier = getNextTier(count);
  const saving = BASE_PRICE * count - total;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Calculá tu precio</div>
        <div className="text-sm text-gray-500">¿Cuántos agentes tiene tu equipo?</div>
      </div>
      <div className="px-6 py-5">
        {/* Slider */}
        <div className="flex items-center gap-4 mb-5">
          <input type="range" min={1} max={30} value={count} onChange={e => setCount(Number(e.target.value))}
            className="flex-1 accent-red-700" />
          <div className="w-16 text-center">
            <span className="font-black text-2xl" style={{ fontFamily: "Georgia, serif", color: RED }}>{count}</span>
            <div className="text-xs text-gray-400">agentes</div>
          </div>
        </div>

        {/* Resultado */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-xs text-gray-400 mb-1">Total por mes</div>
            <div className="font-black text-2xl" style={{ fontFamily: "Georgia, serif", color: RED }}>{formatPriceARS(total)}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-xs text-gray-400 mb-1">Por agente</div>
            <div className="font-black text-2xl" style={{ fontFamily: "Georgia, serif", color: RED }}>{formatPriceARS(perAgent)}</div>
            {saving > 0 && <div className="text-xs text-green-600 font-bold mt-1">Ahorrás {formatPriceARS(saving)}/mes</div>}
          </div>
        </div>

        {/* Incentivo */}
        {nextTier && toNext !== null && (
          <div className="rounded-xl px-4 py-3 text-sm"
            style={{ background: toNext === 1 ? "#fffbeb" : "#fff8f8", border: `1px solid ${toNext === 1 ? "#fde68a" : "#fee2e2"}` }}>
            {toNext === 1
              ? <span className="font-black text-amber-700">🔥 Con 1 agente más todos bajan a {formatPriceARS(pricePerAgent(BASE_PRICE, nextTier.minAgents))}/agente — pagás lo mismo</span>
              : <span className="font-bold" style={{ color: RED }}>💡 Faltan {toNext} agentes para -{nextTier.discountPct}% en todo el equipo</span>
            }
          </div>
        )}
        {!nextTier && (
          <div className="rounded-xl px-4 py-3 bg-yellow-50 border border-yellow-200 text-sm font-black text-yellow-700 text-center">
            👑 Máximo descuento — -40% activo
          </div>
        )}

        <button onClick={() => onCheckout(count)}
          className="w-full mt-4 py-3 rounded-xl text-sm font-black text-white hover:opacity-90 transition-all"
          style={{ background: RED }}>
          Empezar con {count} agente{count !== 1 ? "s" : ""} — {formatPriceARS(total)}/mes →
        </button>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleCheckout = async (agentCount: number) => {
    // Si no está logueado, guardar intención y mandar al login
    if (!session?.user) {
      router.push(`/login?callbackUrl=/pricing&agents=${agentCount}`);
      return;
    }
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentCount }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || "Error al iniciar el pago");
      }
    } catch {
      alert("Error de conexión");
    }
    setCheckoutLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>Precios — InmoCoach</title></Head>
      <div className="h-1 w-full" style={{ background: RED }} />

      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={13} /> Volver
          </button>
          <div className="font-black text-lg ml-auto" style={{ fontFamily: "Georgia, serif" }}>
            Precios · <span style={{ color: RED }}>InmoCoach</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-6">

        {/* Hero */}
        <div className="text-center py-4">
          <h1 className="text-3xl font-black text-gray-900 mb-2" style={{ fontFamily: "Georgia, serif" }}>
            Un precio que crece con vos
          </h1>
          <p className="text-gray-500 text-sm">Cuantos más agentes sumás, menos pagás por cada uno.</p>
        </div>

        {/* Plan Individual */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Individual</div>
              <div className="text-xl font-black text-gray-900" style={{ fontFamily: "Georgia, serif" }}>Para el agente solo</div>
              <p className="text-sm text-gray-500 mt-1">Dashboard personal, IAC, racha, ranking global.</p>
            </div>
            <div className="text-right shrink-0">
              <div className="font-black text-3xl" style={{ fontFamily: "Georgia, serif", color: RED, lineHeight: 1 }}>
                {formatPriceARS(BASE_PRICE)}
              </div>
              <div className="text-xs text-gray-400 mt-1">/mes</div>
            </div>
          </div>
          <div className="px-6 pb-5">
            <button onClick={() => router.push("/login")}
              className="w-full py-3 rounded-xl text-sm font-black text-white hover:opacity-90 transition-all"
              style={{ background: RED }}>
              Empezar gratis 7 días →
            </button>
          </div>
        </div>

        {/* Tabla de tiers */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Users size={14} className="text-gray-400" />
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Descuentos por equipo</span>
          </div>
          <div className="divide-y divide-gray-50">
            {VOLUME_TIERS.map((tier, i) => {
              const exampleCount = tier.maxAgents ? Math.floor((tier.minAgents + tier.maxAgents) / 2) : tier.minAgents + 5;
              const agentPrice = pricePerAgent(BASE_PRICE, tier.minAgents);
              const isFirst = i === 0;
              return (
                <div key={tier.minAgents} className={`px-6 py-4 flex items-center gap-4 ${!isFirst ? "" : ""}`}>
                  <div className="w-16 shrink-0">
                    <span className="text-sm font-black text-gray-700">
                      {tier.minAgents === 1 ? "1–4" : tier.minAgents === 5 ? "5–9" : tier.minAgents === 10 ? "10–19" : "20+"}
                    </span>
                    <div className="text-xs text-gray-400">agentes</div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{tier.label}</span>
                      {tier.discountPct > 0 && (
                        <span className="text-xs font-black px-2 py-0.5 rounded-full text-white bg-green-500">
                          -{tier.discountPct}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black" style={{ color: RED, fontFamily: "Georgia, serif" }}>
                      {formatPriceARS(agentPrice)}
                    </div>
                    <div className="text-xs text-gray-400">/agente/mes</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Simulador */}
        <AgentSimulator onCheckout={handleCheckout} />

        {/* Qué incluye */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Qué incluye el equipo</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              "Dashboard individual para cada agente",
              "Dashboard del broker con ranking del equipo",
              "IAC colectivo e individual",
              "Alertas automáticas de racha en riesgo",
              "Ranking interno del equipo",
              "Inmo Coach con IA para cada agente",
              "Mail semanal personalizado por agente",
              "Invitaciones por email",
            ].map((feature, i) => (
              <div key={i} className="flex items-start gap-2">
                <Check size={13} className="text-green-500 shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pb-4">
          <p className="text-sm text-gray-400 mb-3">7 días gratis · Sin tarjeta de crédito · Cancelás cuando querés</p>
          <button onClick={() => handleCheckout(1)} disabled={checkoutLoading}
            className="px-8 py-3 rounded-xl font-black text-white text-sm hover:opacity-90 transition-all disabled:opacity-60"
            style={{ background: RED }}>
            Empezar ahora →
          </button>
        </div>

      </main>
    </div>
  );
}
