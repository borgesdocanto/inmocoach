import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { DEFAULT_RANKS } from "../lib/ranksConfig";

const RED = "#aa0000";

interface RankConfig {
  slug: string; label: string; icon: string; sort_order: number;
  min_weeks: number; min_iac_up: number; min_iac_keep: number; min_streak?: number;
}

export default function RangosPage() {
  const router = useRouter();
  const [ranks, setRanks] = useState<RankConfig[]>([]);
  const [weeksToUp, setWeeksToUp] = useState(4);
  const [weeksToDown, setWeeksToDown] = useState(2);

  useEffect(() => {
    fetch("/api/admin/ranks-config")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.ranks?.length) {
          setRanks(d.ranks);
          setWeeksToUp(parseInt(d.weeksToUp ?? "4"));
          setWeeksToDown(parseInt(d.weeksToDown ?? "2"));
        } else {
          // Fallback a defaults
          setRanks(DEFAULT_RANKS.map(r => ({
            slug: r.slug, label: r.label, icon: r.icon, sort_order: r.sortOrder,
            min_weeks: r.minWeeks, min_iac_up: r.minIacUp, min_iac_keep: r.minIacKeep,
            min_streak: (r as any).minStreak,
          })));
        }
      })
      .catch(() => {
        setRanks(DEFAULT_RANKS.map(r => ({
          slug: r.slug, label: r.label, icon: r.icon, sort_order: r.sortOrder,
          min_weeks: r.minWeeks, min_iac_up: r.minIacUp, min_iac_keep: r.minIacKeep,
        })));
      });
  }, []);

  const sorted = [...ranks].sort((a, b) => a.sort_order - b.sort_order);
  const descriptions: Record<string, string> = {
    junior: "Recién arrancaste. Empezá a cargar tus reuniones y vas a subir rápido.",
    corredor: "Estás tomando el hábito — mantené el ritmo.",
    asesor: "Tu actividad es consistente y genera resultados.",
    senior: "Sos un referente de actividad en el equipo.",
    top_producer: "Estás en la élite de producción.",
    master_broker: "El nivel más alto. El desafío ahora es mantenerse.",
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>Rangos — InmoCoach</title></Head>
      <div className="h-1 w-full" style={{ background: RED }} />
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={13} /> Volver
          </button>
          <div className="font-black text-lg ml-auto" style={{ fontFamily: "Georgia, serif" }}>Rangos · <span style={{ color: RED }}>InmoCoach</span></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8 space-y-5">
        {/* Explicación */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Sistema de rangos</div>
          <h1 className="text-2xl font-black text-gray-900 mb-3" style={{ fontFamily: "Georgia, serif" }}>¿Cómo funcionan los rangos?</h1>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Tu rango refleja tu consistencia comercial. Subís rápido si mantenés actividad — y bajás si la abandonás.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-4">
              <div className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Para subir</div>
              <div className="text-sm text-green-800"><strong>{weeksToUp} semanas consecutivas</strong> con IAC sobre el umbral del próximo rango.</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4">
              <div className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Para bajar</div>
              <div className="text-sm text-red-800"><strong>{weeksToDown} semanas consecutivas</strong> con IAC bajo el umbral de mantenimiento.</div>
            </div>
          </div>
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700">⚠️ Una semana mala no te baja. Dos semanas seguidas sin actividad, sí.</p>
          </div>
        </div>

        {/* Lista de rangos */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <div className="text-xs font-black text-gray-500 uppercase tracking-widest">Los {sorted.length} rangos</div>
          </div>
          <div className="divide-y divide-gray-50">
            {sorted.map((rank, i) => (
              <div key={rank.slug} className="px-5 py-5 flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                  style={{ background: i === 0 ? "#f3f4f6" : i === sorted.length - 1 ? "#fffbeb" : "#fff1f1" }}>
                  {rank.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-black text-base text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{rank.label}</span>
                    {i === sorted.length - 1 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Nivel máximo</span>}
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-3">{descriptions[rank.slug] ?? ""}</p>
                  {rank.min_weeks > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600">📅 {rank.min_weeks} sem. activas</span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-green-50 text-green-700">↑ Subir: IAC ≥ {rank.min_iac_up}%</span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-700">↓ Mantener: IAC ≥ {rank.min_iac_keep}%</span>
                      {rank.min_streak && <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600">🔥 Racha ≥ {rank.min_streak} días</span>}
                    </div>
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500">Automático al registrarte</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ actualizado */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Preguntas frecuentes</div>
          {[
            { q: "¿Cuándo se actualiza mi rango?", a: "Cada vez que sincronizás el calendario y cada lunes automáticamente." },
            { q: "¿Cuántas semanas necesito para subir?", a: `${weeksToUp} semanas consecutivas con IAC sobre el umbral del próximo rango. No hace falta que sean perfectas — solo sobre el umbral.` },
            { q: "¿Puedo bajar de rango?", a: `Sí, si tu IAC cae bajo el umbral de mantenimiento por ${weeksToDown} semanas seguidas. Una semana mala no alcanza.` },
            { q: "¿El rango aparece en el equipo?", a: "Sí. Tu broker ve tu rango en el dashboard del equipo." },
          ].map((item, i) => (
            <div key={i} className={i > 0 ? "pt-4 border-t border-gray-50" : ""}>
              <div className="text-sm font-bold text-gray-900 mb-1">{item.q}</div>
              <div className="text-sm text-gray-500 leading-relaxed">{item.a}</div>
            </div>
          ))}
        </div>

        <div className="text-center py-2">
          <button onClick={() => router.push("/")} className="px-6 py-3 rounded-xl text-sm font-black text-white hover:opacity-90 transition-all" style={{ background: RED }}>
            Ver mi dashboard →
          </button>
        </div>
      </main>
    </div>
  );
}
