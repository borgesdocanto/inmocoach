import Head from "next/head";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import { CheckCircle, TrendingUp, Users, Brain, Mail, Calendar, BarChart2, ArrowRight, Target } from "lucide-react";

const RED = "#aa0000";

export default function Landing() {
  const router = useRouter();

  return (
    <div style={{ background: "#f9fafb", minHeight: "100vh", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: "#111827" }}>
      <Head>
        <title>InmoCoach — El 80% trabaja. El 20% produce.</title>
        <meta name="description" content="InmoCoach sincroniza tu Google Calendar, mide tus reuniones cara a cara y te da feedback real de tu negocio cada semana." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet" />
        <style>{`
          @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
          .f1{animation:fadeUp 0.6s ease forwards;animation-delay:0.05s;opacity:0}
          .f2{animation:fadeUp 0.6s ease forwards;animation-delay:0.15s;opacity:0}
          .f3{animation:fadeUp 0.6s ease forwards;animation-delay:0.25s;opacity:0}
          .f4{animation:fadeUp 0.6s ease forwards;animation-delay:0.35s;opacity:0}
          .card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;transition:box-shadow 0.2s,border-color 0.2s}
          .card:hover{box-shadow:0 4px 20px rgba(0,0,0,0.07);border-color:#d1d5db}
          a{text-decoration:none}
        `}</style>
      </Head>

      <div style={{ height: 3, background: RED }} />

      {/* NAV */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #f3f4f6", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ fontFamily: "Georgia, serif", fontWeight: 900, fontSize: 20, color: "#111827", marginRight: "auto" }}>
            Inmo<span style={{ color: RED }}>Coach</span>
          </div>
          <a href="#como-funciona" style={{ color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Cómo funciona</a>
          <a href="/pricing" style={{ color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Precios</a>
          <button onClick={() => signIn('google', { callbackUrl: '/' })}
            style={{ background: RED, color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Empezar gratis
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: "80px 24px 72px", textAlign: "center" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="f1" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff1f1", border: "1px solid #fecaca", borderRadius: 100, padding: "6px 16px", marginBottom: 28 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: RED }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: RED, letterSpacing: "0.05em", textTransform: "uppercase" }}>Solo el 20% de los inmobiliarios produce resultados reales</span>
          </div>
          <h1 className="f2" style={{ fontFamily: "Georgia, serif", fontSize: "clamp(40px, 6vw, 68px)", fontWeight: 900, lineHeight: 1.05, marginBottom: 24, color: "#111827" }}>
            Dejá de adivinar<br /><span style={{ color: RED }}>cómo está tu negocio</span>
          </h1>
          <p className="f3" style={{ fontSize: "clamp(15px, 2vw, 18px)", color: "#6b7280", maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.7 }}>
            InmoCoach sincroniza tu agenda, mide tus reuniones cara a cara y te dice exactamente qué estás haciendo bien, qué perdés y cuál es la próxima acción concreta.
          </p>
          <div className="f4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => signIn('google', { callbackUrl: '/' })}
              style={{ background: RED, color: "#fff", border: "none", borderRadius: 12, padding: "15px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              Probalo 7 días gratis <ArrowRight size={15} />
            </button>
            <a href="#como-funciona"
              style={{ background: "#fff", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 12, padding: "15px 32px", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center" }}>
              Cómo funciona
            </a>
          </div>
          <p style={{ marginTop: 16, fontSize: 12, color: "#9ca3af" }}>Sin tarjeta de crédito · 7 días completos · Cancelás cuando querés</p>
        </div>
      </section>

      {/* STATS */}
      <section style={{ padding: "0 24px 72px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {[
            { num: "80%", label: "de los inmobiliarios no mide su actividad comercial" },
            { num: "15", label: "reuniones cara a cara por semana es el estándar del top producer" },
            { num: "3x", label: "más operaciones cierra quien mide y ajusta su semana" },
            { num: "7 días", label: "son suficientes para ver el patrón que frena tu negocio" },
          ].map((s, i) => (
            <div key={i} className="card" style={{ padding: 24 }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 40, fontWeight: 900, color: RED, lineHeight: 1, marginBottom: 8 }}>{s.num}</div>
              <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* EL PROBLEMA */}
      <section style={{ padding: "72px 24px", background: "#fff", borderTop: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, color: RED, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>El problema real</p>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
              Ocupado no es<br />lo mismo que<br /><span style={{ color: RED }}>productivo</span>
            </h2>
            <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.8, marginBottom: 16 }}>
              El inmobiliario promedio trabaja todo el día pero llega a fin de mes sin entender por qué no cerró más. La respuesta es siempre la misma: <strong style={{ color: "#111827" }}>nunca midió nada.</strong>
            </p>
            <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.8 }}>
              Sin datos reales operás por percepción. Y la percepción siempre te miente — te hace sentir ocupado cuando en realidad estás reactivo.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { icon: "📊", title: "No saben cuántas reuniones hicieron", desc: "Trabajan de intuición, no de números." },
              { icon: "🔄", title: "Trabajan mucho pero no producen", desc: "Actividad ≠ productividad comercial." },
              { icon: "🚫", title: "Nadie les da feedback de su negocio", desc: "Solos, sin espejo, sin dirección." },
              { icon: "📉", title: "Viven en piloto automático", desc: "El 80% opera así. Vos podés ser el 20%." },
            ].map((p, i) => (
              <div key={i} className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>{p.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{p.title}</div>
                  <div style={{ fontSize: 13, color: "#9ca3af" }}>{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" style={{ padding: "72px 24px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: RED, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Cómo funciona</p>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 900, lineHeight: 1.1 }}>
              Conectás. Medís. <span style={{ color: RED }}>Mejorás.</span>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {[
              { num: "01", icon: <Calendar size={18} style={{ color: RED }} />, title: "Conectás tu Google Calendar", desc: "Un solo click. Sin cargar nada manualmente. InmoCoach lee tus eventos y detecta automáticamente tus reuniones comerciales cara a cara." },
              { num: "02", icon: <Target size={18} style={{ color: RED }} />, title: "Medimos lo que importa", desc: "Tasaciones, visitas, propuestas, cierres. Filtramos el ruido administrativo y te mostramos solo la actividad que genera negocio real." },
              { num: "03", icon: <Brain size={18} style={{ color: RED }} />, title: "Tu coach te habla claro", desc: "Inmo Coach analiza tu semana con IA y te dice en qué perfil caíste, qué oportunidades perdiste y cuál es la única acción que más impacto tiene." },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: 28 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div style={{ width: 40, height: 40, background: "#fff1f1", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 36, fontWeight: 900, color: "#f3f4f6", lineHeight: 1 }}>{s.num}</div>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: "72px 24px", background: "#fff", borderTop: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 900, lineHeight: 1.1 }}>
              Todo lo que necesitás<br /><span style={{ color: RED }}>para medir y crecer</span>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {[
              { icon: <BarChart2 size={16} style={{ color: RED }} />, title: "Dashboard semanal y mensual", desc: "Visualizá tu actividad real en calendario. Ves exactamente qué días fuiste productivo y cuáles solo estuviste ocupado." },
              { icon: <Brain size={16} style={{ color: RED }} />, title: "Inmo Coach con IA", desc: "Diagnóstico personalizado con tu actividad real. No frases genéricas — análisis específico de tu semana con acción concreta." },
              { icon: <Mail size={16} style={{ color: RED }} />, title: "Reporte semanal por email", desc: "Todos los lunes recibís tu semana anterior analizada. Arrancás la semana con datos, no con sensaciones." },
              { icon: <Users size={16} style={{ color: RED }} />, title: "Dashboard de equipo (Teams)", desc: "Para brokers: ves la actividad de todos tus agentes en un solo lugar. Sabés quién necesita coaching antes de que sea tarde." },
              { icon: <TrendingUp size={16} style={{ color: RED }} />, title: "Tendencia de 90 días", desc: "Gráfico de evolución para saber si estás mejorando o en caída libre. Los números no mienten." },
              { icon: <Target size={16} style={{ color: RED }} />, title: "Meta de productividad diaria", desc: "10 reuniones cara a cara = día productivo. Un objetivo claro, medible y alcanzable para cada jornada." },
            ].map((f, i) => (
              <div key={i} className="card" style={{ padding: "22px 24px", display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ width: 36, height: 36, background: "#fff1f1", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{f.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section style={{ padding: "72px 24px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: RED, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Resultados reales</p>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 900, lineHeight: 1.1 }}>
              Lo que dicen los que<br /><span style={{ color: RED }}>ya miden</span>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {[
              { name: "Marcela R.", role: "Inmobiliaria independiente, CABA", text: "Siempre creí que era productiva. Cuando empecé a medir me di cuenta que el 70% de mis reuniones eran administrativas. Eso cambió todo." },
              { name: "Rodrigo T.", role: "Broker con 12 agentes, GBA", text: "El dashboard del equipo es lo mejor. Ahora sé exactamente quién necesita ayuda sin esperar a fin de mes para ver los resultados." },
              { name: "Valeria M.", role: "Top producer, Córdoba", text: "No entendía por qué algunas semanas cerraba y otras no. El patrón era claro: menos de 12 reuniones cara a cara = menos operaciones." },
            ].map((t, i) => (
              <div key={i} className="card" style={{ padding: 28 }}>
                <div style={{ color: RED, fontSize: 28, fontFamily: "Georgia, serif", lineHeight: 1, marginBottom: 14 }}>"</div>
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, marginBottom: 20 }}>{t.text}</p>
                <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section id="precios" style={{ padding: "72px 24px", background: "#fff", borderTop: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: RED, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Precios</p>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 16 }}>
            Empezás gratis.<br /><span style={{ color: RED }}>El precio crece con tu equipo.</span>
          </h2>
          <p style={{ color: "#9ca3af", fontSize: 15, marginBottom: 40, lineHeight: 1.7 }}>
            7 días sin tarjeta. Individual desde <strong style={{ color: "#111" }}>$10.500/mes</strong>. Equipos con descuento por volumen — cuantos más agentes, menos pagás por cada uno.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => router.push("/pricing")}
              style={{ background: RED, color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Ver precios y simulador →
            </button>
            <button onClick={() => signIn('google', { callbackUrl: '/' })}
              style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Empezar gratis 7 días
            </button>
          </div>
          <div style={{ display: "flex", gap: 32, justifyContent: "center", marginTop: 40, flexWrap: "wrap" }}>
            {[
              { range: "1 agente", price: "$10.500", label: "Individual" },
              { range: "5–9 agentes", price: "$8.400", label: "−20% por agente" },
              { range: "10–19 agentes", price: "$7.350", label: "−30% por agente" },
              { range: "20+ agentes", price: "$6.300", label: "−40% por agente" },
            ].map((t, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 900, color: RED }}>{t.price}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginTop: 2 }}>{t.range}</div>
                <div style={{ fontSize: 11, color: "#d1d5db", marginTop: 2 }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
            El próximo lunes vas a saber<br /><span style={{ color: RED }}>exactamente cómo estás</span>
          </h2>
          <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 36, lineHeight: 1.7 }}>
            Conectás tu Google Calendar hoy. El lunes siguiente recibís tu primer análisis. Sin excusas, sin adivinanzas.
          </p>
          <button onClick={() => signIn('google', { callbackUrl: '/' })}
            style={{ background: RED, color: "#fff", border: "none", borderRadius: 12, padding: "16px 40px", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10 }}>
            Empezar 7 días gratis <ArrowRight size={16} />
          </button>
          <p style={{ marginTop: 14, fontSize: 12, color: "#9ca3af" }}>Sin tarjeta · Sin contrato · Cancelás cuando querés</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#fff", borderTop: "1px solid #f3f4f6", padding: "28px 24px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ fontFamily: "Georgia, serif", fontWeight: 900, fontSize: 16 }}>Inmo<span style={{ color: RED }}>Coach</span></div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <a href="/privacidad" style={{ color: "#9ca3af", fontSize: 12 }}>Política de privacidad</a>
            <a href="/terminos" style={{ color: "#9ca3af", fontSize: 12 }}>Términos de uso</a>
            <a onClick={() => signIn('google', { callbackUrl: '/' })} style={{ color: "#9ca3af", fontSize: 12, cursor: "pointer" }}>Iniciar sesión</a>
          </div>
          <p style={{ color: "#d1d5db", fontSize: 12 }}>© 2025 InmoCoach · inmocoach.com.ar</p>
        </div>
      </footer>
    </div>
  );
}
