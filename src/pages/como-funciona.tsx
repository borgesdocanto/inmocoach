import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { Calendar, TrendingUp, Target, ArrowRight, CheckCircle, Zap, Users, BarChart2 } from "lucide-react";

const RED = "#aa0000";
const GREEN = "#16a34a";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function FadeIn({ children, delay = 0, className = "" }: any) {
  const { ref, visible } = useInView();
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

export default function ComoFunciona() {
  const router = useRouter();

  return (
    <div style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", background: "#fafafa", color: "#111" }}>
      <Head>
        <title>Cómo funciona — InstaCoach</title>
        <meta name="description" content="InstaCoach mide tu actividad comercial real desde Google Calendar. Descubrí el modelo IAC y cómo los mejores inmobiliarios del mercado generan resultados consistentes." />
      </Head>

      {/* Top accent */}
      <div className="h-1 w-full" style={{ background: RED }} />

      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/">
            <span className="font-black text-xl tracking-tight cursor-pointer" style={{ fontFamily: "Georgia, serif" }}>
              Insta<span style={{ color: RED }}>Coach</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <span className="text-xs font-bold text-gray-400 hover:text-gray-700 cursor-pointer transition-colors">Planes</span>
            </Link>
            <button onClick={() => router.push("/login")}
              className="text-xs font-black px-4 py-2 rounded-xl text-white transition-all hover:opacity-90"
              style={{ background: RED }}>
              Empezar gratis
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-5 pt-20 pb-16 text-center">
        <FadeIn>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-6"
            style={{ background: "#fef2f2", color: RED }}>
            <Zap size={11} /> El método de los Top Producers
          </div>
        </FadeIn>
        <FadeIn delay={100}>
          <h1 className="text-5xl sm:text-6xl font-black leading-tight mb-6 text-gray-900" style={{ fontFamily: "Georgia, serif" }}>
            Tu agenda ya tiene<br />
            <span style={{ color: RED }}>todas las respuestas.</span>
          </h1>
        </FadeIn>
        <FadeIn delay={200}>
          <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed mb-8">
            Los inmobiliarios que más ganan no tienen suerte — tienen un patrón de actividad.
            InstaCoach lo mide, lo muestra y te ayuda a sostenerlo.
          </p>
        </FadeIn>
        <FadeIn delay={300}>
          <button onClick={() => router.push("/login")}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-black text-white transition-all hover:opacity-90 shadow-lg"
            style={{ background: RED, boxShadow: `0 8px 30px rgba(170,0,0,0.25)` }}>
            Conectar mi calendario <ArrowRight size={15} />
          </button>
          <p className="text-xs text-gray-400 mt-3">7 días gratis · Sin tarjeta de crédito</p>
        </FadeIn>
      </section>

      {/* El problema */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <FadeIn>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl p-8 border-2" style={{ borderColor: "#fecaca", background: "#fff5f5" }}>
              <div className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: RED }}>El problema</div>
              <h3 className="text-xl font-black text-gray-900 mb-4" style={{ fontFamily: "Georgia, serif" }}>
                "Estuve muy ocupado esta semana"
              </h3>
              <ul className="space-y-2.5">
                {[
                  "Llamadas, mails, publicaciones en redes",
                  "Mucha actividad, pocos resultados concretos",
                  "No sabés cuántas reuniones tuviste en realidad",
                  "Fin de mes: los números no cierran",
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: RED }} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl p-8 border-2" style={{ borderColor: "#bbf7d0", background: "#f0fdf4" }}>
              <div className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: GREEN }}>La solución</div>
              <h3 className="text-xl font-black text-gray-900 mb-4" style={{ fontFamily: "Georgia, serif" }}>
                "Esta semana tuve 14 reuniones cara a cara"
              </h3>
              <ul className="space-y-2.5">
                {[
                  "Sabes exactamente cuántos verdes tuviste",
                  "Ves en qué días sos más productivo",
                  "Tu IAC te dice si vas bien o hay que acelerar",
                  "Fin de mes: los números tienen sentido",
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: GREEN }} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Cómo funciona — 3 pasos */}
      <section className="py-16" style={{ background: "#fff" }}>
        <div className="max-w-5xl mx-auto px-5">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black text-gray-900 mb-3" style={{ fontFamily: "Georgia, serif" }}>
                Tres pasos, cero fricción
              </h2>
              <p className="text-sm text-gray-400">No cargás nada. El sistema trabaja con lo que ya hacés.</p>
            </div>
          </FadeIn>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                n: "01",
                icon: <Calendar size={22} style={{ color: RED }} />,
                title: "Conectás tu Google Calendar",
                desc: "Un clic. Solo lectura — no modificamos ni borramos nada. Tus eventos quedan exactamente como están.",
              },
              {
                n: "02",
                icon: <Zap size={22} style={{ color: RED }} />,
                title: "El sistema detecta tus eventos comerciales",
                desc: 'Si el evento dice "Tasación", "Visita", "Reunión", "Propuesta" o "Firma" — se cuenta automáticamente como verde.',
              },
              {
                n: "03",
                icon: <BarChart2 size={22} style={{ color: RED }} />,
                title: "Ves tu IAC en tiempo real",
                desc: "Tu Índice de Actividad Comercial actualizado. Sabés si vas a ritmo de Top Producer o necesitás acelerar.",
              },
            ].map((s, i) => (
              <FadeIn key={i} delay={i * 120}>
                <div className="bg-gray-50 rounded-2xl p-6 h-full border border-gray-100">
                  <div className="text-5xl font-black mb-4" style={{ color: "#f3f4f6", fontFamily: "Georgia, serif" }}>{s.n}</div>
                  <div className="mb-3">{s.icon}</div>
                  <h3 className="font-black text-gray-900 mb-2 leading-snug" style={{ fontFamily: "Georgia, serif" }}>{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* El modelo IAC */}
      <section className="py-16 max-w-5xl mx-auto px-5">
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 mb-3" style={{ fontFamily: "Georgia, serif" }}>
              La matemática del Top Producer
            </h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              No es magia. Es actividad consistente, medida y sostenida en el tiempo.
            </p>
          </div>
        </FadeIn>

        <div className="grid sm:grid-cols-2 gap-6 items-center">
          <FadeIn>
            <div className="space-y-4">
              {[
                { label: "Reuniones cara a cara por semana", value: "15", color: RED, desc: "El IAC 100% — el objetivo semanal de un Top Producer" },
                { label: "Captaciones nuevas por semana", value: "3", color: RED, desc: "Tasaciones + propuestas de valor presentadas" },
                { label: "Efectividad del mercado", value: "15%", color: "#d97706", desc: "6 procesos activos generan aproximadamente 1 operación" },
              ].map((m, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center gap-4">
                  <div className="text-3xl font-black flex-shrink-0" style={{ color: m.color, fontFamily: "Georgia, serif", minWidth: 64 }}>{m.value}</div>
                  <div>
                    <div className="font-bold text-sm text-gray-900">{m.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={150}>
            <div className="rounded-2xl p-8 text-white" style={{ background: "#111827" }}>
              <div className="text-xs font-black uppercase tracking-widest mb-6" style={{ color: RED }}>Ejemplo real</div>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-gray-700 pb-3">
                  <span className="text-gray-400">Reuniones / semana</span>
                  <span className="font-black" style={{ color: GREEN }}>15 ✓</span>
                </div>
                <div className="flex justify-between border-b border-gray-700 pb-3">
                  <span className="text-gray-400">Semanas al mes</span>
                  <span className="font-black text-white">× 4</span>
                </div>
                <div className="flex justify-between border-b border-gray-700 pb-3">
                  <span className="text-gray-400">Reuniones al mes</span>
                  <span className="font-black text-white">= 60</span>
                </div>
                <div className="flex justify-between border-b border-gray-700 pb-3">
                  <span className="text-gray-400">Captaciones (20%)</span>
                  <span className="font-black text-white">≈ 12 procesos</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-gray-400">Operaciones cerradas</span>
                  <span className="font-black text-2xl" style={{ color: GREEN }}>≈ 2</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-6 leading-relaxed">
                A ritmo de IAC 100% sostenido, el modelo predice ~2 operaciones por mes.
                El resultado varía según ticket y mercado, pero la actividad es el único factor que controlás.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Qué mide */}
      <section className="py-16" style={{ background: "#fff" }}>
        <div className="max-w-5xl mx-auto px-5">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black text-gray-900 mb-3" style={{ fontFamily: "Georgia, serif" }}>
                Qué mide el dashboard
              </h2>
            </div>
          </FadeIn>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: <TrendingUp size={18} style={{ color: RED }} />, label: "IAC", desc: "Tu índice de actividad vs el objetivo semanal" },
              { icon: <Target size={18} style={{ color: RED }} />, label: "Tasaciones", desc: "Captaciones nuevas iniciadas" },
              { icon: <Users size={18} style={{ color: RED }} />, label: "Visitas", desc: "Propiedades mostradas a compradores" },
              { icon: <CheckCircle size={18} style={{ color: GREEN }} />, label: "Firmas", desc: "Operaciones cerradas en el período" },
            ].map((m, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 text-center">
                  <div className="flex justify-center mb-3">{m.icon}</div>
                  <div className="font-black text-gray-900 mb-1" style={{ fontFamily: "Georgia, serif" }}>{m.label}</div>
                  <div className="text-xs text-gray-400 leading-snug">{m.desc}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 text-center px-5">
        <FadeIn>
          <h2 className="text-4xl font-black text-gray-900 mb-4" style={{ fontFamily: "Georgia, serif" }}>
            Empezá hoy. Es gratis.
          </h2>
          <p className="text-sm text-gray-400 mb-8 max-w-sm mx-auto">
            7 días de acceso completo. Sin tarjeta. Sin compromiso.
            Conectás tu calendario y en 2 minutos ves tu IAC real.
          </p>
          <button onClick={() => router.push("/login")}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-black text-white transition-all hover:opacity-90 shadow-xl"
            style={{ background: RED, boxShadow: `0 12px 40px rgba(170,0,0,0.3)` }}>
            Conectar mi Google Calendar <ArrowRight size={15} />
          </button>
          <div className="flex items-center justify-center gap-6 mt-6">
            {["Solo lectura", "Sin cargar datos", "Cancelás cuando querés"].map((t, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-gray-400">
                <CheckCircle size={11} style={{ color: GREEN }} /> {t}
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-black text-lg" style={{ fontFamily: "Georgia, serif" }}>
            Insta<span style={{ color: RED }}>Coach</span>
          </span>
          <div className="flex gap-5 text-xs text-gray-400">
            <Link href="/privacidad"><span className="hover:text-gray-700 cursor-pointer transition-colors">Privacidad</span></Link>
            <Link href="/terminos"><span className="hover:text-gray-700 cursor-pointer transition-colors">Términos</span></Link>
            <Link href="/pricing"><span className="hover:text-gray-700 cursor-pointer transition-colors">Planes</span></Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
