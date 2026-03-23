import Head from "next/head";
import { useRouter } from "next/router";
import { ArrowRight, CheckCircle } from "lucide-react";

const RED = "#aa0000";
const DARK = "#111827";

// ── Mock screenshots as inline SVG ──────────────────────────────────────────

function ScreenDashboard() {
  return (
    <svg viewBox="0 0 520 320" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", borderRadius: 12, display: "block" }}>
      <rect width="520" height="320" fill="#f4f5f7" rx="12"/>
      {/* sidebar */}
      <rect width="130" height="320" fill="#fff" rx="0"/>
      <rect x="0" y="0" width="130" height="320" rx="12" fill="#fff"/>
      <rect x="12" y="18" width="60" height="12" rx="3" fill="#111827" opacity=".85"/>
      <rect x="12" y="34" width="40" height="8" rx="2" fill="#e5e7eb"/>
      {[0,1,2,3,4,5].map(i => (
        <g key={i}>
          <rect x="12" y={72 + i*34} width="106" height="24" rx="6" fill={i===0 ? "#fef2f2" : "transparent"}/>
          <rect x="22" y={79 + i*34} width="8" height="8" rx="2" fill={i===0 ? RED : "#d1d5db"}/>
          <rect x="36" y={81 + i*34} width={[48,56,60,52,44,58][i]} height="6" rx="2" fill={i===0 ? RED : "#9ca3af"} opacity={i===0 ? 1 : 0.6}/>
        </g>
      ))}
      {/* main */}
      <rect x="142" y="20" width="100" height="9" rx="3" fill="#111827" opacity=".8"/>
      <rect x="142" y="34" width="70" height="7" rx="2" fill="#d1d5db"/>
      {/* 4 cards */}
      {[0,1,2,3].map(i => (
        <g key={i}>
          <rect x={142 + i*92} y="58" width="84" height="72" rx="8" fill="#fff"/>
          <rect x={142 + i*92} y="58" width="84" height="4" rx="4" fill={[RED,"#16a34a","#d97706","#7c3aed"][i]}/>
          <rect x={150 + i*92} y="72" width="40" height="7" rx="2" fill="#d1d5db"/>
          <text x={150 + i*92} y="104" fontFamily="Georgia,serif" fontSize="20" fontWeight="700" fill={[RED,"#16a34a","#d97706","#7c3aed"][i]}>{["67%","✦ 8","#3","OK"][i]}</text>
          <rect x={150 + i*92} y="110" width="50" height="5" rx="2" fill="#e5e7eb"/>
        </g>
      ))}
      {/* week calendar */}
      <rect x="142" y="148" width="366" height="104" rx="8" fill="#fff"/>
      <rect x="152" y="158" width="50" height="6" rx="2" fill="#374151" opacity=".7"/>
      {["L","M","M","J","V","S","D"].map((d,i) => (
        <g key={i}>
          <rect x={152 + i*48} y="172" width="38" height="10" rx="2" fill="#f9fafb"/>
          <text x={168 + i*48} y="181" textAnchor="middle" fontSize="7" fill="#9ca3af">{d}</text>
          {[2,1,3,0,2,1,0][i] > 0 && Array.from({length:[2,1,3,0,2,1,0][i]}).map((_,j) => (
            <rect key={j} x={154 + i*48} y={186 + j*14} width={34} height="11" rx="3" fill={`${RED}22`}/>
          ))}
        </g>
      ))}
      {/* coach */}
      <rect x="142" y="262" width="366" height="44" rx="8" fill="#111827"/>
      <circle cx="160" cy="284" r="10" fill="#374151"/>
      <rect x="176" y="275" width="80" height="6" rx="2" fill="#fff" opacity=".7"/>
      <rect x="176" y="285" width="120" height="5" rx="2" fill="#6b7280"/>
      <rect x="420" y="277" width="72" height="14" rx="6" fill={RED}/>
    </svg>
  );
}

function ScreenTeam() {
  return (
    <svg viewBox="0 0 520 300" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", borderRadius: 12, display: "block" }}>
      <rect width="520" height="300" fill="#f4f5f7" rx="12"/>
      <rect width="130" height="300" fill="#fff"/>
      {[0,1,2,3,4,5].map(i => (
        <g key={i}>
          <rect x="12" y={56 + i*34} width="106" height="24" rx="6" fill={i===4 ? "#fef2f2" : "transparent"}/>
          <rect x="22" y={63 + i*34} width="8" height="8" rx="2" fill={i===4 ? RED : "#d1d5db"}/>
          <rect x="36" y={65 + i*34} width={[48,56,60,52,44,58][i]} height="6" rx="2" fill={i===4 ? RED : "#9ca3af"} opacity={i===4 ? 1 : 0.6}/>
        </g>
      ))}
      {/* header */}
      <rect x="142" y="16" width="90" height="9" rx="3" fill="#111827" opacity=".8"/>
      <rect x="142" y="30" width="60" height="6" rx="2" fill="#d1d5db"/>
      {/* 4 KPI cards */}
      {[0,1,2,3].map(i => (
        <g key={i}>
          <rect x={142 + i*92} y="50" width="84" height="56" rx="8" fill="#fff"/>
          <rect x={142 + i*92} y="50" width="84" height="3" rx="2" fill={[RED,"#16a34a","#d97706",RED][i]}/>
          <rect x={150 + i*92} y="60" width="44" height="5" rx="2" fill="#e5e7eb"/>
          <text x={150 + i*92} y="86" fontFamily="Georgia,serif" fontSize="18" fontWeight="700" fill={[RED,"#16a34a","#d97706",RED][i]}>{["$67k","94%","↑12%","3"][i]}</text>
        </g>
      ))}
      {/* ranking table */}
      <rect x="142" y="118" width="366" height="166" rx="8" fill="#fff"/>
      <rect x="152" y="128" width="60" height="6" rx="2" fill="#374151" opacity=".7"/>
      {/* cols header */}
      {["Agente","IAC","Racha","Tendencia"].map((h,i) => (
        <rect key={i} x={152 + [0,130,190,250][i]} y="142" width={[80,40,40,70][i]} height="5" rx="2" fill="#d1d5db"/>
      ))}
      {/* rows */}
      {[
        {name:"Ana Martínez",iac:94,racha:7,color:"#16a34a"},
        {name:"Luis Gómez",iac:78,racha:4,color:"#d97706"},
        {name:"Paula Díaz",iac:61,racha:2,color:"#d97706"},
        {name:"Ariel Vega",iac:45,racha:1,color:RED},
        {name:"Sol Fernández",iac:32,racha:0,color:RED},
      ].map((r,i) => (
        <g key={i}>
          <rect x="142" y={154 + i*24} width="366" height="24" fill={i%2===0?"#f9fafb":"#fff"}/>
          <circle cx="162" cy={166 + i*24} r="7" fill="#e5e7eb"/>
          <rect x="174" y={162 + i*24} width="60" height="5" rx="2" fill="#374151" opacity=".7"/>
          {/* IAC bar */}
          <rect x="282" y={162 + i*24} width="50" height="7" rx="3" fill="#f3f4f6"/>
          <rect x="282" y={162 + i*24} width={r.iac/2} height="7" rx="3" fill={r.color} opacity=".7"/>
          <text x="340" y={169 + i*24} fontSize="7" fill={r.color} fontWeight="600">{r.iac}%</text>
          <rect x="352" y={162 + i*24} width="20" height="7" rx="3" fill={r.color} opacity=".15"/>
          <text x="356" y={169 + i*24} fontSize="7" fill={r.color}>{r.racha}w</text>
        </g>
      ))}
    </svg>
  );
}

function ScreenCartera() {
  return (
    <svg viewBox="0 0 520 300" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", borderRadius: 12, display: "block" }}>
      <rect width="520" height="300" fill="#f4f5f7" rx="12"/>
      <rect width="130" height="300" fill="#fff"/>
      {[0,1,2,3,4,5].map(i => (
        <g key={i}>
          <rect x="12" y={56 + i*34} width="106" height="24" rx="6" fill={i===3 ? "#fef2f2" : "transparent"}/>
          <rect x="22" y={63 + i*34} width="8" height="8" rx="2" fill={i===3 ? RED : "#d1d5db"}/>
          <rect x="36" y={65 + i*34} width={[48,56,60,52,44,58][i]} height="6" rx="2" fill={i===3 ? RED : "#9ca3af"} opacity={i===3 ? 1 : 0.6}/>
        </g>
      ))}
      <rect x="142" y="16" width="80" height="9" rx="3" fill="#111827" opacity=".8"/>
      {/* KPI cards */}
      {[
        {label:"Disponibles",val:"24",color:"#374151"},
        {label:"Fichas OK",val:"11",color:"#16a34a"},
        {label:"Por mejorar",val:"9",color:RED},
        {label:"+90 días",val:"4",color:"#d97706"},
      ].map((k,i) => (
        <g key={i}>
          <rect x={142 + i*92} y="40" width="84" height="60" rx="8" fill="#fff"/>
          <rect x={142 + i*92} y="40" width="84" height="3" rx="2" fill={k.color}/>
          <rect x={150 + i*92} y="52" width="44" height="5" rx="2" fill="#e5e7eb"/>
          <text x={152 + i*92} y="80" fontFamily="Georgia,serif" fontSize="20" fontWeight="700" fill={k.color}>{k.val}</text>
        </g>
      ))}
      {/* property grid */}
      {[0,1,2,3,4,5].map(i => (
        <g key={i}>
          <rect x={142 + (i%3)*124} y={116 + Math.floor(i/3)*90} width="114" height="80" rx="8" fill="#e5e7eb"/>
          <rect x={142 + (i%3)*124} y={116 + Math.floor(i/3)*90} width="114" height="52" rx="8" fill="#d1d5db"/>
          <rect x={148 + (i%3)*124} y={172 + Math.floor(i/3)*90} width="70" height="5" rx="2" fill="#374151" opacity=".6"/>
          <rect x={148 + (i%3)*124} y={181 + Math.floor(i/3)*90} width="50" height="4" rx="2" fill="#9ca3af"/>
          {i === 2 && <rect x={218} y={120} width="30" height="12" rx="4" fill={RED}/>}
          {i === 2 && <rect x={221} y={124} width="24" height="4" rx="2" fill="#fff"/>}
          {i === 4 && <rect x={342} y={210} width="36" height="12" rx="4" fill="#d97706"/>}
          {i === 4 && <rect x={345} y={214} width="30" height="4" rx="2" fill="#fff"/>}
        </g>
      ))}
    </svg>
  );
}

// ── Main Landing ─────────────────────────────────────────────────────────────

export default function Landing() {
  const router = useRouter();

  return (
    <div style={{ background: "#f9fafb", minHeight: "100vh", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: DARK }}>
      <Head>
        <title>InmoCoach — Medí tu actividad. Mejorá tu cartera. Cerrá más.</title>
        <meta name="description" content="InmoCoach mide tu actividad comercial en Google Calendar, analiza tus fichas en Tokko Broker y te da feedback real con IA cada semana." />
      </Head>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        .f1{animation:fadeUp .55s ease forwards;animation-delay:.05s;opacity:0}
        .f2{animation:fadeUp .55s ease forwards;animation-delay:.15s;opacity:0}
        .f3{animation:fadeUp .55s ease forwards;animation-delay:.25s;opacity:0}
        .f4{animation:fadeUp .55s ease forwards;animation-delay:.35s;opacity:0}
        .ic-card{background:#fff;border:0.5px solid #e5e7eb;border-radius:14px;transition:box-shadow .2s,border-color .2s}
        .ic-card:hover{box-shadow:0 4px 20px rgba(0,0,0,0.07);border-color:#d1d5db}
        .ic-screen{background:#fff;border:0.5px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.09)}
        @media(max-width:900px){.ic-2col{grid-template-columns:1fr!important}.ic-hide-mobile{display:none!important}}
        @media(max-width:640px){.ic-3col{grid-template-columns:1fr!important}}
        a{text-decoration:none}
      `}</style>

      {/* NAV */}
      <nav style={{ background: "#fff", borderBottom: "0.5px solid #e5e7eb", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: 20, color: DARK, marginRight: "auto" }}>
            Inmo<span style={{ color: RED }}>Coach</span>
          </div>
          <a href="#como-funciona" style={{ color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Cómo funciona</a>
          <a href="#para-quien" style={{ color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Para quién</a>
          <a href="/pricing" style={{ color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Precios</a>
          <button onClick={() => router.push("/login")}
            style={{ background: RED, color: "#fff", border: "none", borderRadius: 10, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Empezar gratis
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: "80px 24px 64px", textAlign: "center" }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <div className="f1" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: 100, padding: "5px 16px", marginBottom: 28 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: RED }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: RED, letterSpacing: "0.05em", textTransform: "uppercase" }}>Actividad · Calidad de fichas · Coach IA</span>
          </div>
          <h1 className="f2" style={{ fontFamily: "Georgia, serif", fontSize: "clamp(38px, 6vw, 66px)", fontWeight: 500, lineHeight: 1.08, marginBottom: 24, color: DARK }}>
            Medí tu actividad.<br />Mejorá tu cartera.<br /><span style={{ color: RED }}>Cerrá más.</span>
          </h1>
          <p className="f3" style={{ fontSize: "clamp(15px, 2vw, 17px)", color: "#6b7280", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.75 }}>
            InmoCoach mide tus reuniones cara a cara en Google Calendar, analiza el estado de tus fichas en Tokko Broker y te da un diagnóstico semanal con IA. Todo en un solo lugar.
          </p>
          <div className="f4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
            <button onClick={() => router.push("/login")}
              style={{ background: RED, color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              Probalo 7 días gratis <ArrowRight size={15} />
            </button>
            <a href="#como-funciona"
              style={{ background: "#fff", color: "#374151", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 500, display: "flex", alignItems: "center" }}>
              Ver cómo funciona
            </a>
          </div>
          <p style={{ fontSize: 12, color: "#9ca3af" }}>Sin tarjeta de crédito · 7 días completos · Cancelás cuando querés</p>
        </div>
      </section>

      {/* SCREENSHOT HERO */}
      <section style={{ padding: "0 24px 80px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div className="ic-screen">
            <div style={{ padding: "8px 12px", background: "#f9fafb", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", gap: 6 }}>
              {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#e5e7eb", marginLeft: 8, maxWidth: 200 }} />
            </div>
            <ScreenDashboard />
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ padding: "0 24px 80px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }} className="ic-3col">
          {[
            { num: "2 en 1", label: "Actividad comercial + calidad de cartera en un solo dashboard" },
            { num: "15", label: "reuniones cara a cara por semana = estándar del top producer" },
            { num: "3x", label: "más cierres logra quien mide y ajusta su semana con datos reales" },
            { num: "IA", label: "analiza tu perfil de semana y te da la única acción que más impacta" },
          ].map((s, i) => (
            <div key={i} className="ic-card" style={{ padding: "22px 24px" }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500, color: RED, lineHeight: 1, marginBottom: 8 }}>{s.num}</div>
              <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PROPUESTA DE VALOR — 3 PILARES */}
      <section id="como-funciona" style={{ padding: "80px 24px", background: "#fff", borderTop: "0.5px solid #e5e7eb", borderBottom: "0.5px solid #e5e7eb" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: RED, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Lo que medimos</p>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(30px, 4vw, 46px)", fontWeight: 500, lineHeight: 1.1, margin: 0 }}>
              Tres pilares de tu negocio<br /><span style={{ color: RED }}>finalmente medidos</span>
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }} className="ic-3col">
            {[
              {
                num: "01", color: RED,
                title: "Actividad comercial",
                sub: "Google Calendar",
                desc: "Detectamos automáticamente tus reuniones cara a cara — tasaciones, visitas, propuestas, cierres. Sin cargar nada. Calculamos tu IAC (Índice de Actividad Comercial) en tiempo real.",
                bullets: ["Reuniones detectadas automáticamente", "IAC semanal y mensual", "Racha de productividad y rangos", "Alerta si tu racha está en riesgo"],
              },
              {
                num: "02", color: "#16a34a",
                title: "Calidad de cartera",
                sub: "Tokko Broker",
                desc: "Conectamos tu Tokko y analizamos cada ficha: fotos, plano, video, tour 360° y antigüedad de publicación. Sabés exactamente cuáles fichas están perdiendo visitas por estar incompletas.",
                bullets: ["Estado de cada propiedad publicada", "Alertas de fichas incompletas", "Propiedades sin actualizar +90 días", "Vista broker: cartera de cada agente"],
              },
              {
                num: "03", color: "#7c3aed",
                title: "Coach IA semanal",
                sub: "Análisis personalizado",
                desc: "Inmo Coach analiza tu actividad + el estado de tu cartera y te da un diagnóstico honesto: qué hiciste bien, dónde perdiste oportunidades y cuál es la única acción concreta para esta semana.",
                bullets: ["Perfil de semana (productivo / reactivo / en riesgo)", "Análisis de oportunidades perdidas", "Acción concreta semanal", "Reporte por email todos los lunes"],
              },
            ].map((p, i) => (
              <div key={i} className="ic-card" style={{ padding: 28, borderTop: `3px solid ${p.color}`, borderRadius: "0 0 14px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 30, fontWeight: 500, color: "#f3f4f6", lineHeight: 1 }}>{p.num}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: DARK }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: p.color, fontWeight: 500, marginTop: 1 }}>{p.sub}</div>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.75, marginBottom: 16 }}>{p.desc}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {p.bullets.map((b, j) => (
                    <div key={j} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <CheckCircle size={12} style={{ color: p.color, flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 12, color: "#374151" }}>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SCREENS — EQUIPO */}
      <section id="para-quien" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }} className="ic-2col">
            <div>
              <p style={{ fontSize: 11, fontWeight: 500, color: RED, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Para brokers</p>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 500, lineHeight: 1.15, marginBottom: 16 }}>
                Todo tu equipo.<br /><span style={{ color: RED }}>Un solo lugar.</span>
              </h2>
              <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.8, marginBottom: 20 }}>
                Dashboard del equipo con ranking interno, IAC colectivo, alertas de racha en riesgo y estado de cartera por agente. Sabés quién necesita coaching antes de que los números lo digan.
              </p>
              {[
                "Ranking semanal de actividad con tendencia",
                "Alerta automática cuando un agente está en riesgo",
                "Cartera Tokko desglosada por agente",
                "Invitación de agentes con 1 click desde Tokko",
              ].map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                  <CheckCircle size={14} style={{ color: RED, flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#374151" }}>{f}</span>
                </div>
              ))}
            </div>
            <div className="ic-screen">
              <div style={{ padding: "8px 12px", background: "#f9fafb", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", gap: 6 }}>
                {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
              </div>
              <ScreenTeam />
            </div>
          </div>
        </div>
      </section>

      {/* SCREENS — CARTERA */}
      <section style={{ padding: "0 24px 80px", background: "#fff", borderTop: "0.5px solid #e5e7eb" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", paddingTop: 80 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }} className="ic-2col">
            <div className="ic-screen ic-hide-mobile">
              <div style={{ padding: "8px 12px", background: "#f9fafb", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", gap: 6 }}>
                {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
              </div>
              <ScreenCartera />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 500, color: "#16a34a", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Para agentes</p>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 500, lineHeight: 1.15, marginBottom: 16 }}>
                Tus fichas hablan.<br /><span style={{ color: RED }}>¿Las estás escuchando?</span>
              </h2>
              <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.8, marginBottom: 20 }}>
                El estándar de una ficha que convierte: 15+ fotos, plano, video o tour 360° y actualizada. InmoCoach lo mide por vos y te alerta cuando una propiedad está perdiendo oportunidades.
              </p>
              {[
                "Fotos, plano, video y tour 360° por propiedad",
                "Alerta de fichas incompletas con detalle",
                "Propiedades publicadas hace más de 90 días sin cambios",
                "Acceso directo a editar en Tokko desde la app",
              ].map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                  <CheckCircle size={14} style={{ color: "#16a34a", flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#374151" }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PARA QUIEN — CARDS */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 500, lineHeight: 1.1, margin: 0 }}>
              Diseñado para <span style={{ color: RED }}>cada rol</span>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {[
              {
                icon: "◈", color: RED, title: "Agente independiente",
                desc: "Tu IAC semanal, racha de productividad, ranking global y el estado de tu cartera Tokko. El espejo que nunca tuviste.",
                items: ["Dashboard personal", "IAC y racha", "Coach IA semanal", "Cartera Tokko"],
              },
              {
                icon: "⊞", color: "#7c3aed", title: "Broker con equipo",
                desc: "Actividad individual + colectiva, cartera por agente, alertas automáticas. Hacés coaching con datos, no con sensaciones.",
                items: ["Dashboard de equipo", "Ranking interno", "Cartera por agente", "Alertas de racha"],
              },
              {
                icon: "✦", color: "#d97706", title: "Team leader",
                desc: "Visibilidad de tu subequipo dentro de la organización. Sabés quién va bien y quién necesita apoyo esta semana.",
                items: ["Vista de tu grupo", "Ranking comparativo", "Historial por agente", "Acceso a carteras"],
              },
            ].map((r, i) => (
              <div key={i} className="ic-card" style={{ padding: 28, borderTop: `3px solid ${r.color}`, borderRadius: "0 0 14px 14px" }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{r.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: DARK, marginBottom: 8 }}>{r.title}</div>
                <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7, marginBottom: 16 }}>{r.desc}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {r.items.map((item, j) => (
                    <span key={j} style={{ fontSize: 11, fontWeight: 500, background: "#f3f4f6", color: "#374151", borderRadius: 6, padding: "3px 10px" }}>{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section style={{ padding: "80px 24px", background: "#fff", borderTop: "0.5px solid #e5e7eb", borderBottom: "0.5px solid #e5e7eb" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: RED, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Resultados reales</p>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 500, lineHeight: 1.1, margin: 0 }}>
              Lo que dicen los que<br /><span style={{ color: RED }}>ya miden</span>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {[
              { name: "Marcela R.", role: "Agente independiente, CABA", text: "Siempre creí que era productiva. Cuando empecé a medir me di cuenta que el 70% de mis reuniones eran administrativas. Eso cambió todo." },
              { name: "Rodrigo T.", role: "Broker con 12 agentes, GBA", text: "El dashboard del equipo es lo mejor. Ahora sé exactamente quién necesita ayuda sin esperar a fin de mes para verlo en los números." },
              { name: "Valeria M.", role: "Agente, Córdoba", text: "Tenía fichas publicadas hacía más de 6 meses sin tocar. InmoCoach me las marcó y en una semana actualicé todo. Recibí 3 consultas más en 2 días." },
            ].map((t, i) => (
              <div key={i} className="ic-card" style={{ padding: 28 }}>
                <div style={{ color: RED, fontSize: 32, fontFamily: "Georgia, serif", lineHeight: 1, marginBottom: 14 }}>"</div>
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, marginBottom: 20 }}>{t.text}</p>
                <div style={{ borderTop: "0.5px solid #f3f4f6", paddingTop: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: RED, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Precios</p>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 500, lineHeight: 1.1, marginBottom: 14 }}>
            Empezás gratis.<br /><span style={{ color: RED }}>El precio crece con tu equipo.</span>
          </h2>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 40, lineHeight: 1.75 }}>
            7 días sin tarjeta. Individual desde <strong style={{ color: DARK }}>$10.500/mes</strong>. Equipos con descuento por volumen — cuantos más agentes, menos pagás por cada uno.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 }}>
            <button onClick={() => router.push("/pricing")}
              style={{ background: RED, color: "#fff", border: "none", borderRadius: 12, padding: "13px 32px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
              Ver precios y simulador →
            </button>
            <button onClick={() => router.push("/login")}
              style={{ background: "#fff", color: "#374151", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "13px 32px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
              Empezar gratis 7 días
            </button>
          </div>
          <div style={{ display: "flex", gap: 32, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { range: "1 agente", price: "$10.500", label: "Individual" },
              { range: "5–9 agentes", price: "$8.400", label: "−20%" },
              { range: "10–19 agentes", price: "$7.350", label: "−30%" },
              { range: "20+ agentes", price: "$6.300", label: "−40%" },
            ].map((t, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 500, color: RED }}>{t.price}</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", marginTop: 2 }}>{t.range}</div>
                <div style={{ fontSize: 11, color: "#d1d5db", marginTop: 1 }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: "80px 24px", background: DARK }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 500, lineHeight: 1.1, color: "#fff", marginBottom: 16 }}>
            El próximo lunes vas a saber<br /><span style={{ color: RED }}>exactamente cómo estás</span>
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", marginBottom: 36, lineHeight: 1.75 }}>
            Conectás tu Google Calendar hoy. El lunes siguiente recibís tu primer análisis de actividad, con el estado de tu cartera incluido.
          </p>
          <button onClick={() => router.push("/login")}
            style={{ background: RED, color: "#fff", border: "none", borderRadius: 12, padding: "15px 40px", fontSize: 15, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10 }}>
            Empezar 7 días gratis <ArrowRight size={15} />
          </button>
          <p style={{ marginTop: 14, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Sin tarjeta · Sin contrato · Cancelás cuando querés</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#fff", borderTop: "0.5px solid #e5e7eb", padding: "28px 24px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: 16, color: DARK }}>Inmo<span style={{ color: RED }}>Coach</span></div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <a href="/privacidad" style={{ color: "#9ca3af", fontSize: 12 }}>Política de privacidad</a>
            <a href="/terminos" style={{ color: "#9ca3af", fontSize: 12 }}>Términos de uso</a>
            <a href="/login" style={{ color: "#9ca3af", fontSize: 12 }}>Iniciar sesión</a>
          </div>
          <p style={{ color: "#d1d5db", fontSize: 12, margin: 0 }}>© 2025 InmoCoach · inmocoach.com.ar</p>
        </div>
      </footer>
    </div>
  );
}
