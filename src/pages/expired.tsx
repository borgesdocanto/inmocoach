import Head from "next/head";
import { useRouter } from "next/router";
import { Lock, Zap } from "lucide-react";
import { BRAND } from "../lib/brand";

export default function ExpiredPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f0f9ff" }}>
      <Head><title>Tu prueba terminó — InmoCoach</title></Head>
      <div className="h-1 fixed top-0 left-0 right-0"
        style={{ background: `linear-gradient(90deg, ${BRAND.color}, ${BRAND.colorDark})` }} />

      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white font-black text-2xl shadow-xl"
            style={{ background: `linear-gradient(135deg, ${BRAND.color}, ${BRAND.colorDark})` }}>
            <Zap size={28} />
          </div>
          <div className="font-black text-2xl" style={{ color: BRAND.color }}>InmoCoach</div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center bg-slate-100">
            <Lock size={24} className="text-slate-400" />
          </div>

          <h1 className="font-black text-2xl text-slate-800 mb-2">
            Tu prueba gratuita terminó
          </h1>
          <p className="text-slate-400 font-medium text-sm mb-6 leading-relaxed">
            Tuviste 7 días completos para sentir lo que es tener un coach activo.
            Para seguir recibiendo tu informe semanal y usar el Inmo Coach, activá tu plan.
          </p>

          <div className="bg-slate-50 rounded-2xl p-4 mb-6 text-left">
            <div className="font-black text-sm text-slate-700 mb-2">Plan Individual — $10.500/mes</div>
            <ul className="space-y-1.5">
              {["Inmo Coach ilimitado", "Informe semanal personalizado", "Historial completo", "Cancelás cuando querés"].map(f => (
                <li key={f} className="text-xs text-slate-500 font-medium flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: BRAND.color }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => router.push("/pricing")}
            className="w-full py-4 rounded-2xl font-black text-white text-sm transition-all hover:-translate-y-0.5 hover:shadow-xl mb-3"
            style={{ background: `linear-gradient(135deg, ${BRAND.color}, ${BRAND.colorDark})` }}>
            Activar mi plan →
          </button>

          <button
            onClick={() => router.push("/pricing")}
            className="w-full py-3 rounded-2xl font-bold text-slate-500 text-sm hover:text-slate-700 transition-colors">
            Ver todos los planes
          </button>
        </div>
      </div>
    </div>
  );
}
