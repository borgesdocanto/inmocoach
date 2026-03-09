import React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState } from "react";
import Head from "next/head";
import { CheckCircle, Users, ArrowLeft } from "lucide-react";
import { PLANS, Plan } from "../lib/plans";
import { formatPriceARS } from "../lib/pricing";

const RED = "#aa0000";

function PlanCard({ plan, livePrice, current, onSelect, loading }: {
  plan: Plan;
  livePrice?: number;
  current?: string;
  onSelect: (id: string) => void;
  loading: string | null;
}) {
  const isCurrent = current === plan.id;
  const isLoading = loading === plan.id;
  const price = livePrice ?? plan.priceARS;

  return (
    <div className={`bg-white rounded-2xl p-6 flex flex-col border transition-all ${plan.highlight ? "border-gray-900 shadow-lg" : "border-gray-100"}`}>
      {plan.badge && (
        <div className="text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg self-start mb-4"
          style={{ background: "#111827", color: "#fff" }}>
          {plan.badge}
        </div>
      )}

      <div className="mb-1">
        <div className="font-black text-lg text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{plan.name}</div>
        <div className="text-xs text-gray-400 mt-0.5">{plan.description}</div>
      </div>

      <div className="my-4 flex items-end gap-1">
        {price === 0 ? (
          <span className="font-black text-3xl text-gray-900" style={{ fontFamily: "Georgia, serif" }}>Gratis</span>
        ) : (
          <>
            <span className="font-black text-3xl text-gray-900" style={{ fontFamily: "Georgia, serif" }}>
              $ {price.toLocaleString("es-AR")}
            </span>
            <span className="text-sm text-gray-400 mb-1">/ mes</span>
          </>
        )}
      </div>

      <ul className="space-y-2 mb-6 flex-1">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
            <CheckCircle size={13} className="shrink-0 mt-0.5" style={{ color: "#16a34a" }} />
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(plan.id)}
        disabled={isCurrent || isLoading}
        className="w-full py-3 rounded-xl text-sm font-black transition-all disabled:opacity-50"
        style={plan.highlight
          ? { background: "#111827", color: "#fff" }
          : { background: "#f3f4f6", color: "#374151" }}>
        {isLoading ? "Procesando..." : isCurrent ? "Plan actual" : price === 0 ? "Empezar gratis" : `Suscribirse — $ ${price.toLocaleString("es-AR")}/mes`}
      </button>
    </div>
  );
}

export default function PricingPage() {
  const [livePricing, setLivePricing] = React.useState<Record<string, number>>({ individual: 10500, teams: 75000 });
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const current = router.query.current as string ?? "free";

  const handleSelect = async (planId: string) => {
    if (planId === "free") { router.push("/"); return; }
    if (!session) { router.push("/login"); return; }
    setLoading(planId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch { alert("Error al procesar. Intentá de nuevo."); }
    setLoading(null);
  };

  // Precio de Teams para mostrar en la nota de info
  const teamsPrice = livePricing["teams"] ?? 75000;
  const indPrice = livePricing["individual"] ?? 10500;
  const perAgent = Math.round(teamsPrice / 10);

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>Planes — InmoCoach</title></Head>
      <div className="h-0.5 w-full" style={{ background: RED }} />

      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors mr-auto">
            <ArrowLeft size={13} /> Volver
          </button>
          <div className="font-black text-lg tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
            Inmo<span style={{ color: RED }}>Coach</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-gray-900 mb-2" style={{ fontFamily: "Georgia, serif" }}>
            Elegí tu plan
          </h1>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            7 días de acceso completo para vivir la experiencia. Después suscribite y se renueva automáticamente cada mes. Cancelás cuando querés.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
          {Object.values(PLANS).map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              livePrice={livePricing[plan.id]}
              current={current}
              onSelect={handleSelect}
              loading={loading}
            />
          ))}
        </div>

        <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            <Users size={14} className="text-gray-500" />
          </div>
          <div>
            <div className="font-black text-sm text-gray-900 mb-1">Cómo funciona Teams</div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Con Teams activado cargás los emails de tus inmobiliarios y el sistema les manda una invitación.
              Hasta 10 agentes incluidos en $ {teamsPrice.toLocaleString("es-AR")}/mes — son $ {perAgent.toLocaleString("es-AR")}/agente vs $ {indPrice.toLocaleString("es-AR")} del plan Individual.
              Si necesitás más de 10, agregás adicionales a $ {indPrice.toLocaleString("es-AR")}/mes cada uno.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-300 mt-6">
          Suscripción mensual automática procesada por MercadoPago · Cancelás cuando querés desde tu cuenta MP · Los emails @galas.com.ar tienen acceso Individual gratuito permanente
        </p>
      </main>
    </div>
  );
}
