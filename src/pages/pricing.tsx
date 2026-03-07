import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState } from "react";
import Head from "next/head";
import { CheckCircle, Zap, Users, Loader2, ArrowLeft } from "lucide-react";
import { PLANS, Plan } from "../lib/plans";

const RED = "#aa0000";

function PlanCard({ plan, current, onSelect, loading }: {
  plan: Plan; current?: string;
  onSelect: (id: string) => void; loading: string | null;
}) {
  const isCurrent = current === plan.id;
  const isLoading = loading === plan.id;
  const isHighlight = plan.highlight;

  return (
    <div className={`bg-white rounded-2xl p-6 flex flex-col border transition-all ${isHighlight ? "border-gray-900 shadow-lg" : "border-gray-100"}`}>
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

      <div className="my-5 pb-5 border-b border-gray-100">
        {plan.price === 0 ? (
          <div>
            <span className="font-black text-4xl text-gray-900" style={{ fontFamily: "Georgia, serif" }}>Gratis</span>
            <div className="text-xs text-gray-400 mt-1">7 días completos · sin tarjeta</div>
          </div>
        ) : (
          <div>
            <span className="font-black text-4xl text-gray-900" style={{ fontFamily: "Georgia, serif" }}>USD {plan.price}</span>
            <span className="text-gray-400 text-sm"> / mes</span>
            <div className="text-xs text-gray-400 mt-1">≈ ARS {plan.priceARS.toLocaleString("es-AR")} / mes</div>
          </div>
        )}
      </div>

      <ul className="space-y-2.5 mb-6 flex-1">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
            <CheckCircle size={13} className="shrink-0 mt-0.5" style={{ color: isHighlight ? RED : "#9ca3af" }} />
            {f}
          </li>
        ))}
      </ul>

      <button onClick={() => onSelect(plan.id)} disabled={isCurrent || isLoading}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
        style={isHighlight
          ? { background: "#111827", color: "#fff" }
          : { background: "#f3f4f6", color: "#374151" }}>
        {isLoading && <Loader2 size={13} className="animate-spin" />}
        {isCurrent ? "Plan actual" : plan.price === 0 ? "Empezar gratis" : `Suscribirse — USD ${plan.price}/mes`}
      </button>
    </div>
  );
}

export default function PricingPage() {
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

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>Planes — InstaCoach</title></Head>
      <div className="h-0.5 w-full" style={{ background: RED }} />

      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors mr-auto">
            <ArrowLeft size={13} /> Volver
          </button>
          <div className="font-black text-lg tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
            Insta<span style={{ color: RED }}>Coach</span>
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
            <PlanCard key={plan.id} plan={plan} current={current} onSelect={handleSelect} loading={loading} />
          ))}
        </div>

        {/* Teams info */}
        <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            <Users size={14} className="text-gray-500" />
          </div>
          <div>
            <div className="font-black text-sm text-gray-900 mb-1">Cómo funciona Teams</div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Con Teams activado cargás los emails de tus inmobiliarios y el sistema les manda una invitación.
              Hasta 10 incluidos en USD 50/mes — son USD 5/inmobiliario vs USD 7 del plan Individual.
              Si necesitás más de 10, agregás adicionales a USD 7/mes cada uno.
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
