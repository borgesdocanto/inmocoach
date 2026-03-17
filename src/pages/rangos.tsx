import Head from "next/head";
import { useRouter } from "next/router";
import { ArrowLeft } from "lucide-react";
import { DEFAULT_RANKS } from "../lib/ranksConfig";

const RED = "#aa0000";

export default function RangosPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Head><title>Rangos — InmoCoach</title></Head>
      <div className="h-1 w-full" style={{ background: RED }} />
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors"><ArrowLeft size={13} /> Volver</button>
          <div className="font-black text-lg ml-auto" style={{ fontFamily: "Georgia, serif" }}>Rangos · <span style={{ color: RED }}>InmoCoach</span></div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-8 space-y-5">
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Sistema de rangos</div>
          <h1 className="text-2xl font-black text-gray-900 mb-3" style={{ fontFamily: "Georgia, serif" }}>¿Cómo se ganan los rangos?</h1>
          <p className="text-sm text-gray-600 leading-relaxed">Tu rango refleja tu actividad comercial acumulada en los últimos 3 meses. Se calcula con dos variables: <strong>semanas activas</strong> (semanas donde tenés IAC {">"} 0%) y tu <strong>IAC promedio</strong> en esas semanas.</p>
          <div className="mt-4 bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-4">
            <div><div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Semanas activas</div><div className="text-sm text-gray-600">Las últimas <strong>12 semanas</strong> donde registraste al menos 1 reunión.</div></div>
            <div><div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">IAC promedio</div><div className="text-sm text-gray-600">Tu <strong>promedio de IAC</strong> en esas 12 semanas. Importa la consistencia.</div></div>
          </div>
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700">⚠️ <strong>Podés perder rango</strong> si tu actividad baja sostenidamente. Se recalcula cada lunes.</p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100"><div className="text-xs font-black text-gray-500 uppercase tracking-widest">Los 6 rangos</div></div>
          <div className="divide-y divide-gray-50">
            {DEFAULT_RANKS.map((rank, i) => (
              <div key={rank.slug} className="px-5 py-5 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: i === 0 ? "#f3f4f6" : i === DEFAULT_RANKS.length - 1 ? "#fffbeb" : "#fff1f1" }}>{rank.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-black text-base text-gray-900" style={{ fontFamily: "Georgia, serif" }}>{rank.label}</span>
                    {i === DEFAULT_RANKS.length - 1 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Nivel máximo</span>}
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-3">{rank.description}</p>
                  {rank.minWeeks > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600">📅 {rank.minWeeks} semanas activas</span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600">📊 IAC prom. ≥ {rank.minIacUp ?? 0}%</span>
                      {(rank as any).minStreak && <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600">🔥 Racha máx. ≥ {(rank as any).minStreak} días</span>}
                    </div>
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500">Automático al registrarte</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Preguntas frecuentes</div>
          {[
            { q: "¿Cuándo se actualiza mi rango?", a: "Cada lunes cuando InmoCoach procesa tu semana. También se recalcula cada vez que sincronizás el calendario." },
            { q: "¿Puedo bajar de rango?", a: "Sí. Si tu IAC promedio de las últimas 12 semanas cae por debajo del umbral de tu rango, bajás automáticamente." },
            { q: "¿Qué pasa si faltó una semana?", a: "Las semanas con IAC 0% no se cuentan como activas, pero no te las restan. Solo cuentan las semanas donde trabajaste." },
            { q: "¿El rango aparece en el equipo?", a: "Sí. Tu broker ve tu rango en el dashboard del equipo." },
          ].map((item, i) => (
            <div key={i} className={i > 0 ? "pt-4 border-t border-gray-50" : ""}>
              <div className="text-sm font-bold text-gray-900 mb-1">{item.q}</div>
              <div className="text-sm text-gray-500 leading-relaxed">{item.a}</div>
            </div>
          ))}
        </div>

        <div className="text-center py-2">
          <button onClick={() => router.push("/")} className="px-6 py-3 rounded-xl text-sm font-black text-white hover:opacity-90 transition-all" style={{ background: RED }}>Ver mi dashboard →</button>
        </div>
      </main>
    </div>
  );
}
