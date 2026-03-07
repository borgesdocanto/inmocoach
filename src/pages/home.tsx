import Head from "next/head";
import { useRouter } from "next/router";

const RED = "#aa0000";
const DARK = "#0a0a0a";

export default function Landing() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>InstaCoach — El 80% de los inmobiliarios trabaja mucho. El 20% produce.</title>
        <meta name="description" content="InstaCoach sincroniza tu agenda, mide tus reuniones cara a cara y te da feedback real de tu negocio cada semana. Dejá de adivinar. Empezá a medir." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      </Head>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: ${DARK}; color: white; font-family: 'DM Sans', sans-serif; overflow-x: hidden; }
        .bebas { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.02em; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lineGrow {
          from { width: 0; }
          to { width: 100%; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        .fade-1 { animation: fadeUp 0.7s ease forwards; animation-delay: 0.1s; opacity: 0; }
        .fade-2 { animation: fadeUp 0.7s ease forwards; animation-delay: 0.3s; opacity: 0; }
        .fade-3 { animation: fadeUp 0.7s ease forwards; animation-delay: 0.5s; opacity: 0; }
        .fade-4 { animation: fadeUp 0.7s ease forwards; animation-delay: 0.7s; opacity: 0; }

        .stat-card {
          background: #141414;
          border: 1px solid #222;
          border-radius: 16px;
          padding: 28px;
          transition: border-color 0.2s, transform 0.2s;
        }
        .stat-card:hover { border-color: ${RED}; transform: translateY(-4px); }

        .feature-card {
          background: #111;
          border: 1px solid #1e1e1e;
          border-radius: 20px;
          padding: 32px;
          transition: all 0.25s;
          position: relative;
          overflow: hidden;
        }
        .feature-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: ${RED};
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s ease;
        }
        .feature-card:hover::before { transform: scaleX(1); }
        .feature-card:hover { border-color: #2a2a2a; }

        .plan-card {
          background: #111;
          border: 1px solid #222;
          border-radius: 20px;
          padding: 36px 28px;
          transition: all 0.25s;
        }
        .plan-card.featured {
          background: ${RED};
          border-color: ${RED};
          position: relative;
        }
        .plan-card:not(.featured):hover { border-color: #444; transform: translateY(-4px); }

        .cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: ${RED};
          color: white;
          font-family: 'DM Sans', sans-serif;
          font-weight: 700;
          font-size: 15px;
          padding: 16px 32px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }
        .cta-btn:hover { background: #cc0000; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(170,0,0,0.4); }

        .cta-btn-outline {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: transparent;
          color: white;
          font-family: 'DM Sans', sans-serif;
          font-weight: 700;
          font-size: 15px;
          padding: 16px 32px;
          border-radius: 14px;
          border: 1px solid #333;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }
        .cta-btn-outline:hover { border-color: #666; background: #1a1a1a; }

        .ticker-wrap { overflow: hidden; white-space: nowrap; }
        .ticker { display: inline-flex; animation: ticker 25s linear infinite; }

        .testimonial {
          background: #111;
          border: 1px solid #1e1e1e;
          border-radius: 16px;
          padding: 28px;
        }

        .number-big {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(64px, 10vw, 120px);
          line-height: 1;
          color: ${RED};
        }

        section { padding: 80px 20px; }
        .container { max-width: 1100px; margin: 0 auto; }

        @media (max-width: 768px) {
          section { padding: 60px 20px; }
          .grid-3 { grid-template-columns: 1fr !important; }
          .grid-2 { grid-template-columns: 1fr !important; }
          .hero-title { font-size: clamp(56px, 15vw, 100px) !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "0 20px", background: "rgba(10,10,10,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", height: 60 }}>
          <div className="bebas" style={{ fontSize: 24, letterSpacing: "0.05em" }}>
            Insta<span style={{ color: RED }}>Coach</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
            <a href="#precios" style={{ color: "#888", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>Precios</a>
            <button className="cta-btn" style={{ padding: "10px 20px", fontSize: 13 }} onClick={() => router.push("/login")}>
              Empezar gratis
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ paddingTop: 140, paddingBottom: 80, paddingLeft: 20, paddingRight: 20, position: "relative", overflow: "hidden" }}>
        {/* Background grid */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#1a1a1a 1px, transparent 1px), linear-gradient(90deg, #1a1a1a 1px, transparent 1px)", backgroundSize: "60px 60px", opacity: 0.3, pointerEvents: "none" }} />
        {/* Red glow */}
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: `radial-gradient(ellipse, ${RED}22 0%, transparent 70%)`, pointerEvents: "none" }} />

        <div className="container" style={{ position: "relative", textAlign: "center" }}>
          <div className="fade-1" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1a0000", border: `1px solid ${RED}44`, borderRadius: 100, padding: "8px 16px", marginBottom: 32 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: RED, animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#ff4444", letterSpacing: "0.05em", textTransform: "uppercase" }}>El 80% trabaja. El 20% produce.</span>
          </div>

          <h1 className="bebas hero-title fade-2" style={{ fontSize: "clamp(72px, 12vw, 140px)", lineHeight: 0.92, marginBottom: 32 }}>
            Dejá de<br />
            <span style={{ color: RED }}>adivinar</span><br />
            tu negocio
          </h1>

          <p className="fade-3" style={{ fontSize: "clamp(16px, 2vw, 20px)", color: "#999", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.6 }}>
            InstaCoach mide tus reuniones cara a cara, analiza tu semana y te dice exactamente qué estás haciendo mal — y qué tenés que hacer distinto.
          </p>

          <div className="fade-4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="cta-btn" onClick={() => router.push("/login")} style={{ fontSize: 16, padding: "18px 36px" }}>
              Probalo 7 días gratis →
            </button>
            <a href="#como-funciona" className="cta-btn-outline" style={{ fontSize: 16, padding: "18px 36px" }}>
              Cómo funciona
            </a>
          </div>

          <p style={{ marginTop: 20, fontSize: 12, color: "#555" }}>Sin tarjeta de crédito · 7 días completos · Cancelás cuando querés</p>
        </div>
      </section>

      {/* TICKER */}
      <div style={{ borderTop: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a", padding: "14px 0", overflow: "hidden", background: "#0d0d0d" }}>
        <div className="ticker">
          {[...Array(2)].map((_, i) => (
            <div key={i} style={{ display: "flex", gap: 0 }}>
              {["MEDÍ TU PRODUCTIVIDAD", "•", "FEEDBACK SEMANAL CON IA", "•", "SINCRONIZACIÓN CON GOOGLE CALENDAR", "•", "REUNIONES CARA A CARA", "•", "COACH SIEMPRE ACTIVO", "•", "EQUIPOS CON DASHBOARD", "•"].map((t, j) => (
                <span key={j} style={{ fontSize: 12, fontWeight: t === "•" ? 400 : 700, color: t === "•" ? RED : "#555", letterSpacing: "0.08em", padding: "0 20px", whiteSpace: "nowrap" }}>{t}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* EL PROBLEMA */}
      <section>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }} className="grid-2">
            <div>
              <p style={{ color: RED, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>El problema real</p>
              <h2 className="bebas" style={{ fontSize: "clamp(48px, 6vw, 80px)", lineHeight: 0.95, marginBottom: 24 }}>
                Ocupado no es<br />lo mismo que<br /><span style={{ color: RED }}>productivo</span>
              </h2>
              <p style={{ color: "#888", fontSize: 16, lineHeight: 1.7, marginBottom: 16 }}>
                El inmobiliario promedio cree que trabaja mucho. Llega a fin de mes y no entiende por qué no cerró más operaciones. La respuesta es simple: <strong style={{ color: "white" }}>nunca midió nada.</strong>
              </p>
              <p style={{ color: "#888", fontSize: 16, lineHeight: 1.7 }}>
                Sin datos reales, tomás decisiones por percepción. Y la percepción siempre te miente.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { pct: "80%", label: "de los inmobiliarios no mide su actividad comercial" },
                { pct: "3x", label: "más operaciones cierra quien lleva registro de sus reuniones" },
                { pct: "15", label: "reuniones cara a cara por semana es el estándar de un top producer" },
              ].map((s, i) => (
                <div key={i} className="stat-card" style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div className="bebas" style={{ fontSize: 52, color: RED, minWidth: 80, lineHeight: 1 }}>{s.pct}</div>
                  <p style={{ color: "#aaa", fontSize: 14, lineHeight: 1.5 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" style={{ background: "#0d0d0d" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ color: RED, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Cómo funciona</p>
            <h2 className="bebas" style={{ fontSize: "clamp(48px, 6vw, 80px)", lineHeight: 0.95 }}>
              Conectás. Medís.<br /><span style={{ color: RED }}>Mejorás.</span>
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }} className="grid-3">
            {[
              {
                num: "01",
                title: "Conectás tu agenda",
                desc: "InstaCoach se sincroniza con tu Google Calendar. Sin cargar nada manualmente. Cada vez que abrís la app, tus datos están actualizados.",
                icon: "📅"
              },
              {
                num: "02",
                title: "Detectamos lo que importa",
                desc: "Filtramos automáticamente tus reuniones cara a cara: tasaciones, visitas, propuestas, cierres. Las separamos del ruido administrativo.",
                icon: "🎯"
              },
              {
                num: "03",
                title: "Tu coach te habla claro",
                desc: "Insta Coach analiza tu semana y te dice en qué perfil caíste, qué perdiste y cuál es la única acción que más impacto tiene para la próxima semana.",
                icon: "🧠"
              },
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
                <div className="bebas" style={{ fontSize: 48, color: `${RED}44`, marginBottom: 8, lineHeight: 1 }}>{f.num}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{f.title}</h3>
                <p style={{ color: "#777", fontSize: 14, lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 className="bebas" style={{ fontSize: "clamp(48px, 6vw, 80px)", lineHeight: 0.95 }}>
              Todo lo que necesitás<br /><span style={{ color: RED }}>para medir y crecer</span>
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }} className="grid-3">
            {[
              { icon: "📊", title: "Dashboard semanal y mensual", desc: "Visualizá tu actividad comercial por semana o mes. Ves el calendario real, no lo que creés que hiciste." },
              { icon: "🤖", title: "Insta Coach con IA", desc: "Diagnóstico personalizado basado en tus números reales. No frases genéricas — análisis específico de tu semana." },
              { icon: "📧", title: "Reporte semanal por email", desc: "Todos los lunes recibís un resumen de tu semana anterior con el análisis del coach. Sin excusas para no saber cómo arrancás." },
              { icon: "👥", title: "Dashboard de equipo", desc: "Para brokers: ves la actividad de todos tus agentes en un solo lugar. Identificás quién necesita coaching antes de que sea tarde." },
              { icon: "📈", title: "Tendencia de 90 días", desc: "Gráfico de evolución para ver si estás mejorando o en caída libre. Los números no mienten." },
              { icon: "🎯", title: "Meta diaria de 10 reuniones", desc: "Un objetivo claro: 10 reuniones cara a cara por día es un día productivo. Simple, medible, alcanzable." },
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ color: "#666", fontSize: 13, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section style={{ background: "#0d0d0d" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 className="bebas" style={{ fontSize: "clamp(48px, 6vw, 72px)", lineHeight: 0.95 }}>
              Lo que dicen los que<br /><span style={{ color: RED }}>ya miden</span>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }} className="grid-3">
            {[
              { name: "Marcela R.", role: "Inmobiliaria independiente, CABA", text: "Siempre creí que era productiva. Cuando empecé a medir, me di cuenta que el 70% de mis reuniones eran administrativas. Eso cambió todo." },
              { name: "Rodrigo T.", role: "Broker, 12 agentes, GBA", text: "El dashboard del equipo es lo mejor. Ahora sé exactamente quién necesita ayuda sin esperar a fin de mes para ver los resultados." },
              { name: "Valeria M.", role: "Top producer, Córdoba", text: "No entendía por qué algunas semanas cerraba y otras no. Ahora tengo los datos. El patrón era claro: cuando bajo de 12 reuniones cara a cara, bajo las operaciones." },
            ].map((t, i) => (
              <div key={i} className="testimonial">
                <div style={{ color: RED, fontSize: 32, marginBottom: 12, lineHeight: 1 }}>"</div>
                <p style={{ color: "#bbb", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>{t.text}</p>
                <div style={{ borderTop: "1px solid #222", paddingTop: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                  <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section id="precios">
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ color: RED, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Precios</p>
            <h2 className="bebas" style={{ fontSize: "clamp(48px, 6vw, 80px)", lineHeight: 0.95 }}>
              Empezás gratis.<br /><span style={{ color: RED }}>Seguís cuando lo vivís.</span>
            </h2>
            <p style={{ color: "#666", fontSize: 15, marginTop: 16 }}>7 días completos sin tarjeta de crédito. Sin límites. Sin trampa.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, maxWidth: 900, margin: "0 auto" }} className="grid-3">
            {[
              {
                id: "free",
                name: "Gratis",
                price: "USD 0",
                period: "7 días",
                desc: "Para conocer la herramienta",
                features: ["Sincronización con Google Calendar", "Dashboard semanal y mensual", "Insta Coach con IA", "Sin tarjeta de crédito"],
                cta: "Empezar ahora",
                featured: false,
              },
              {
                id: "individual",
                name: "Individual",
                price: "USD 7",
                period: "por mes",
                desc: "Para el inmobiliario que quiere crecer",
                features: ["Todo lo del plan gratis", "Acceso permanente", "Reporte semanal por email", "Insta Coach ilimitado", "Historial de 90 días"],
                cta: "Suscribirse",
                featured: true,
              },
              {
                id: "teams",
                name: "Teams",
                price: "USD 50",
                period: "por mes",
                desc: "Para brokers con equipo",
                features: ["Todo lo de Individual", "Hasta 10 agentes incluidos", "Dashboard del broker", "Invitaciones por email", "Roles: Team Leader", "Agentes adicionales: USD 7/c.u."],
                cta: "Suscribir equipo",
                featured: false,
              },
            ].map((plan) => (
              <div key={plan.id} className={`plan-card ${plan.featured ? "featured" : ""}`}>
                {plan.featured && (
                  <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "white", color: RED, fontSize: 11, fontWeight: 800, padding: "4px 14px", borderRadius: 100, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                    MÁS POPULAR
                  </div>
                )}
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: plan.featured ? "rgba(255,255,255,0.7)" : "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>{plan.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                  <span className="bebas" style={{ fontSize: 52, lineHeight: 1, color: plan.featured ? "white" : "white" }}>{plan.price}</span>
                  <span style={{ color: plan.featured ? "rgba(255,255,255,0.6)" : "#555", fontSize: 13 }}>{plan.period}</span>
                </div>
                <p style={{ color: plan.featured ? "rgba(255,255,255,0.7)" : "#666", fontSize: 13, marginBottom: 24 }}>{plan.desc}</p>
                <ul style={{ listStyle: "none", marginBottom: 28 }}>
                  {plan.features.map((f, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10, fontSize: 13, color: plan.featured ? "rgba(255,255,255,0.85)" : "#888" }}>
                      <span style={{ color: plan.featured ? "white" : RED, marginTop: 1, flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => router.push("/login")}
                  style={{
                    width: "100%", padding: "14px", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", border: "none",
                    background: plan.featured ? "white" : "#1a1a1a",
                    color: plan.featured ? RED : "white",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { (e.target as HTMLButtonElement).style.opacity = "0.85"; }}
                  onMouseLeave={e => { (e.target as HTMLButtonElement).style.opacity = "1"; }}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ background: "#0a0a0a", borderTop: "1px solid #1a1a1a" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            <h2 className="bebas" style={{ fontSize: "clamp(56px, 8vw, 100px)", lineHeight: 0.9, marginBottom: 24 }}>
              El próximo lunes<br />vas a saber<br /><span style={{ color: RED }}>exactamente</span><br />cómo estás
            </h2>
            <p style={{ color: "#666", fontSize: 16, marginBottom: 40, lineHeight: 1.6 }}>
              Conectás tu Google Calendar hoy. El lunes que viene recibís tu primer reporte. Sin excusas, sin adivinanzas.
            </p>
            <button className="cta-btn" onClick={() => router.push("/login")} style={{ fontSize: 17, padding: "20px 44px" }}>
              Empezar 7 días gratis →
            </button>
            <p style={{ marginTop: 16, color: "#444", fontSize: 12 }}>Sin tarjeta · Sin contrato · Cancelás cuando querés</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #141414", padding: "32px 20px" }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div className="bebas" style={{ fontSize: 20, letterSpacing: "0.05em" }}>
            Insta<span style={{ color: RED }}>Coach</span>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <a href="/privacidad" style={{ color: "#555", fontSize: 12, textDecoration: "none" }}>Política de privacidad</a>
            <a href="/terminos" style={{ color: "#555", fontSize: 12, textDecoration: "none" }}>Términos de uso</a>
            <a href="/login" style={{ color: "#555", fontSize: 12, textDecoration: "none" }}>Iniciar sesión</a>
          </div>
          <p style={{ color: "#333", fontSize: 12 }}>© 2025 InstaCoach. Todos los derechos reservados.</p>
        </div>
      </footer>
    </>
  );
}
