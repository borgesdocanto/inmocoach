import Head from "next/head";
import { useRouter } from "next/router";
import { ArrowRight, CheckCircle, TrendingUp, Calendar, Building2, Brain } from "lucide-react";

// ── Paleta de marca ──────────────────────────────────────────────────────────
const C = {
  red:    "#aa0000",
  redHi:  "#cc1111",
  redDim: "#880000",
  ink:    "#0c0c0c",
  inkMid: "#161616",
  inkSoft:"#1f1f1f",
  slate:  "#6b6b6b",
  mist:   "#9a9a9a",
  silver: "#c8c8c8",
  white:  "#f5f5f5",
  pure:   "#ffffff",
};

// ── SVG Screens ──────────────────────────────────────────────────────────────
function ScreenDashboard() {
  return (
    <svg viewBox="0 0 560 340" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", display: "block" }}>
      <rect width="560" height="340" fill="#0c0c0c" rx="16"/>
      <rect width="140" height="340" fill="#111111"/>
      {/* logo */}
      <rect x="16" y="16" width="36" height="36" rx="8" fill="#aa0000" opacity=".15"/>
      <rect x="24" y="28" width="20" height="4" rx="2" fill="#aa0000"/>
      <rect x="24" y="36" width="14" height="3" rx="1.5" fill="#cc1111" opacity=".6"/>
      <rect x="58" y="22" width="52" height="7" rx="3" fill="#e2e2e2" opacity=".8"/>
      <rect x="58" y="34" width="36" height="5" rx="2" fill="#444"/>
      {/* nav */}
      {[{ y:76,a:true,w:52},{y:106,a:false,w:44},{y:136,a:false,w:60},{y:166,a:false,w:48},{y:196,a:false,w:40}].map((item,i)=>(
        <g key={i}>
          <rect x="12" y={item.y} width="116" height="22" rx="6" fill={item.a?"#aa0000":"transparent"} opacity={item.a?.15:0}/>
          <rect x="20" y={item.y+7} width="8" height="8" rx="2" fill={item.a?"#aa0000":"#333"}/>
          <rect x="34" y={item.y+9} width={item.w} height="5" rx="2" fill={item.a?"#aa0000":"#444"} opacity={item.a?1:.7}/>
        </g>
      ))}
      {/* KPI cards */}
      {[
        {x:156,color:"#aa0000",val:"87%",label:"IAC Semana"},
        {x:254,color:"#cc9900",val:"✦ 12",label:"Reuniones"},
        {x:352,color:"#888888",val:"#2",label:"Ranking"},
        {x:450,color:"#aa0000",val:"5🔥",label:"Racha"},
      ].map((c,i)=>(
        <g key={i}>
          <rect x={c.x} y="50" width="88" height="78" rx="10" fill="#1a1a1a"/>
          <rect x={c.x} y="50" width="88" height="3" rx="1.5" fill={c.color}/>
          <rect x={c.x+8} y="64" width={[44,38,36,42][i]} height="5" rx="2" fill="#444"/>
          <text x={c.x+8} y="108" fontFamily="Georgia,serif" fontSize="20" fontWeight="700" fill={c.color}>{c.val}</text>
          <rect x={c.x+8} y="116" width="50" height="4" rx="2" fill="#2a2a2a"/>
        </g>
      ))}
      {/* week bar */}
      <rect x="156" y="140" width="382" height="112" rx="10" fill="#1a1a1a"/>
      <rect x="168" y="152" width="55" height="6" rx="3" fill="#e2e2e2" opacity=".5"/>
      {["L","M","M","J","V","S","D"].map((d,i)=>{
        const bars=[3,1,4,0,2,1,0];
        const x=168+i*52;
        return (
          <g key={i}>
            <text x={x+10} y="174" textAnchor="middle" fontSize="7" fill="#555">{d}</text>
            {Array.from({length:bars[i]}).map((_,j)=>(
              <rect key={j} x={x} y={178+j*20} width="38" height="14" rx="4"
                fill="#aa0000" opacity={i===2?.9:.35}/>
            ))}
          </g>
        );
      })}
      {/* coach strip */}
      <rect x="156" y="264" width="382" height="56" rx="10" fill="#aa0000" opacity=".07"/>
      <rect x="156" y="264" width="3" height="56" rx="1.5" fill="#aa0000"/>
      <circle cx="178" cy="292" r="14" fill="#1e1e1e"/>
      <rect x="198" y="280" width="80" height="6" rx="3" fill="#e2e2e2" opacity=".7"/>
      <rect x="198" y="292" width="140" height="5" rx="2" fill="#444"/>
      <rect x="198" y="304" width="100" height="5" rx="2" fill="#333"/>
      <rect x="470" y="280" width="52" height="22" rx="8" fill="#aa0000" opacity=".8"/>
      <rect x="478" y="288" width="36" height="5" rx="2" fill="#fff" opacity=".9"/>
    </svg>
  );
}

function ScreenTeam() {
  return (
    <svg viewBox="0 0 560 320" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", display: "block" }}>
      <rect width="560" height="320" fill="#0c0c0c" rx="16"/>
      <rect width="140" height="320" fill="#111111"/>
      {[0,1,2,3,4,5].map(i=>(
        <g key={i}>
          <rect x="12" y={60+i*36} width="116" height="22" rx="6" fill={i===4?"#aa0000":"transparent"} opacity={i===4?.15:0}/>
          <rect x="20" y={67+i*36} width="8" height="8" rx="2" fill={i===4?"#aa0000":"#333"}/>
          <rect x="34" y={69+i*36} width={[48,56,60,52,44,58][i]} height="5" rx="2" fill={i===4?"#aa0000":"#444"} opacity={i===4?1:.7}/>
        </g>
      ))}
      <rect x="156" y="16" width="90" height="9" rx="4" fill="#e2e2e2" opacity=".8"/>
      {[
        {x:156,color:"#aa0000",val:"8/10"},
        {x:250,color:"#888",val:"94%"},
        {x:344,color:"#cc9900",val:"↑12%"},
        {x:438,color:"#aa0000",val:"3★"},
      ].map((c,i)=>(
        <g key={i}>
          <rect x={c.x} y="36" width="84" height="56" rx="8" fill="#1a1a1a"/>
          <rect x={c.x} y="36" width="84" height="2.5" rx="1.5" fill={c.color}/>
          <rect x={c.x+8} y="46" width="44" height="4" rx="2" fill="#333"/>
          <text x={c.x+8} y="78" fontFamily="Georgia,serif" fontSize="18" fontWeight="700" fill={c.color}>{c.val}</text>
        </g>
      ))}
      <rect x="156" y="104" width="382" height="200" rx="10" fill="#1a1a1a"/>
      <rect x="168" y="116" width="60" height="6" rx="3" fill="#e2e2e2" opacity=".5"/>
      {[
        {name:"Ana Martínez",iac:92,racha:7,color:"#888"},
        {name:"Luis Gómez",iac:78,racha:4,color:"#cc9900"},
        {name:"Paula Díaz",iac:61,racha:2,color:"#cc9900"},
        {name:"Ariel Vega",iac:45,racha:1,color:"#aa0000"},
        {name:"Sol Fernández",iac:30,racha:0,color:"#aa0000"},
      ].map((r,i)=>(
        <g key={i}>
          <rect x="156" y={130+i*32} width="382" height="32" fill={i%2===0?"#141414":"#1a1a1a"}/>
          <circle cx="176" cy={146+i*32} r="9" fill="#222"/>
          <text x="176" y={150+i*32} textAnchor="middle" fontSize="7" fill="#666">{i+1}</text>
          <rect x="192" y={142+i*32} width="70" height="5" rx="2" fill="#c8c8c8" opacity=".8"/>
          <rect x="290" y={142+i*32} width="60" height="8" rx="3" fill="#222"/>
          <rect x="290" y={142+i*32} width={r.iac*.6} height="8" rx="3" fill={r.color} opacity=".7"/>
          <text x="360" y={149+i*32} fontSize="7" fill={r.color} fontWeight="700">{r.iac}%</text>
          <rect x="380" y={142+i*32} width="26" height="8" rx="3" fill={r.color} opacity=".15"/>
          <text x="386" y={149+i*32} fontSize="7" fill={r.color}>{r.racha}w</text>
        </g>
      ))}
    </svg>
  );
}

function ScreenCartera() {
  return (
    <svg viewBox="0 0 560 320" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", display: "block" }}>
      <rect width="560" height="320" fill="#0c0c0c" rx="16"/>
      <rect width="140" height="320" fill="#111111"/>
      {[0,1,2,3,4,5].map(i=>(
        <g key={i}>
          <rect x="12" y={60+i*36} width="116" height="22" rx="6" fill={i===3?"#aa0000":"transparent"} opacity={i===3?.15:0}/>
          <rect x="20" y={67+i*36} width="8" height="8" rx="2" fill={i===3?"#aa0000":"#333"}/>
          <rect x="34" y={69+i*36} width={[48,56,60,52,44,58][i]} height="5" rx="2" fill={i===3?"#aa0000":"#444"} opacity={i===3?1:.7}/>
        </g>
      ))}
      <rect x="156" y="16" width="80" height="9" rx="4" fill="#e2e2e2" opacity=".8"/>
      {[
        {label:"Disponibles",val:"24",color:"#c8c8c8"},
        {label:"Fichas OK",val:"11",color:"#888"},
        {label:"Mejorar",val:"9",color:"#cc9900"},
        {label:"+90 días",val:"4",color:"#aa0000"},
      ].map((k,i)=>(
        <g key={i}>
          <rect x={156+i*98} y="36" width="88" height="60" rx="8" fill="#1a1a1a"/>
          <rect x={156+i*98} y="36" width="88" height="2.5" rx="1.5" fill={k.color}/>
          <rect x={164+i*98} y="46" width="44" height="4" rx="2" fill="#333"/>
          <text x={164+i*98} y="80" fontFamily="Georgia,serif" fontSize="20" fontWeight="700" fill={k.color}>{k.val}</text>
        </g>
      ))}
      {[0,1,2,3,4,5].map(i=>(
        <g key={i}>
          <rect x={156+(i%3)*136} y={112+Math.floor(i/3)*100} width="126" height="88" rx="8" fill="#1a1a1a"/>
          <rect x={156+(i%3)*136} y={112+Math.floor(i/3)*100} width="126" height="56" rx="8" fill="#222"/>
          <rect x={164+(i%3)*136} y={172+Math.floor(i/3)*100} width="75" height="5" rx="2" fill="#c8c8c8" opacity=".6"/>
          <rect x={164+(i%3)*136} y={182+Math.floor(i/3)*100} width="52" height="4" rx="2" fill="#444"/>
          {i===2 && <rect x={248} y={116} width="28" height="14" rx="4" fill="#aa0000" opacity=".8"/>}
          {i===4 && <rect x={384} y={216} width="38" height="14" rx="4" fill="#cc9900" opacity=".8"/>}
        </g>
      ))}
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Landing() {
  const router = useRouter();

  return (
    <div style={{ background: C.ink, minHeight: "100vh", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: C.white, overflowX: "hidden" }}>
      <Head>
        <title>InmoCoach — Medí tu actividad. Mejorá tu cartera. Cerrá más.</title>
        <meta name="description" content="InmoCoach mide tu actividad comercial en Google Calendar, analiza tus fichas en Tokko Broker y te da feedback real con IA cada semana." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .f1 { animation: fadeUp .6s ease forwards; animation-delay: .00s; opacity: 0; }
        .f2 { animation: fadeUp .6s ease forwards; animation-delay: .12s; opacity: 0; }
        .f3 { animation: fadeUp .6s ease forwards; animation-delay: .22s; opacity: 0; }
        .f4 { animation: fadeUp .6s ease forwards; animation-delay: .32s; opacity: 0; }
        .f5 { animation: fadeUp .6s ease forwards; animation-delay: .44s; opacity: 0; }

        .btn-primary {
          background: ${C.red};
          color: ${C.pure};
          border: none;
          border-radius: 10px;
          padding: 13px 28px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background .2s, transform .15s, box-shadow .2s;
          letter-spacing: -.01em;
        }
        .btn-primary:hover {
          background: ${C.redHi};
          transform: translateY(-1px);
          box-shadow: 0 8px 32px rgba(170,0,0,.4);
        }
        .btn-ghost {
          background: rgba(255,255,255,.05);
          color: ${C.silver};
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 10px;
          padding: 13px 28px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background .2s, border-color .2s, color .2s;
        }
        .btn-ghost:hover {
          background: rgba(255,255,255,.09);
          border-color: rgba(255,255,255,.18);
          color: ${C.pure};
        }
        .btn-nav {
          background: ${C.red};
          color: ${C.pure};
          border: none;
          border-radius: 8px;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background .2s, box-shadow .2s;
        }
        .btn-nav:hover {
          background: ${C.redHi};
          box-shadow: 0 4px 20px rgba(170,0,0,.35);
        }

        .ic-card {
          background: ${C.inkMid};
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 16px;
          transition: border-color .25s, transform .25s, box-shadow .25s;
        }
        .ic-card:hover {
          border-color: rgba(170,0,0,.35);
          transform: translateY(-3px);
          box-shadow: 0 20px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(170,0,0,.1);
        }
        .ic-screen {
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.07);
          box-shadow: 0 40px 100px rgba(0,0,0,.7), 0 0 0 1px rgba(170,0,0,.04);
        }
        .ic-screen-bar {
          padding: 10px 14px;
          background: #0a0a0a;
          border-bottom: 1px solid rgba(255,255,255,.05);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ic-dot { width: 10px; height: 10px; border-radius: 50%; }

        .stat-pill {
          background: rgba(170,0,0,.07);
          border: 1px solid rgba(170,0,0,.14);
          border-radius: 14px;
          padding: 24px 28px;
          text-align: center;
        }

        .section-label {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 11px;
          font-weight: 700;
          color: ${C.red};
          letter-spacing: .12em;
          text-transform: uppercase;
          margin-bottom: 18px;
        }
        .section-label::before {
          content: '';
          display: block;
          width: 22px;
          height: 1px;
          background: ${C.red};
        }

        .red-text {
          color: ${C.red};
        }

        .feature-check {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        @media (max-width: 960px) {
          .ic-2col { grid-template-columns: 1fr !important; }
          .ic-hide-mobile { display: none !important; }
          .ic-nav-links { display: none !important; }
        }
        @media (max-width: 640px) {
          .ic-3col { grid-template-columns: 1fr !important; }
          .ic-4col { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        background: "rgba(12,12,12,.9)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,.06)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", gap: 32 }}>
          <div style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 20, color: C.pure, marginRight: "auto", letterSpacing: "-.02em" }}>
            Inmo<span className="red-text">Coach</span>
          </div>
          <div className="ic-nav-links" style={{ display: "flex", gap: 28 }}>
            {[
              { label: "Cómo funciona", href: "#como-funciona" },
              { label: "Para quién", href: "#para-quien" },
              { label: "Precios", href: "/pricing" },
            ].map(l => (
              <a key={l.label} href={l.href} style={{ color: C.slate, fontSize: 13, fontWeight: 500, transition: "color .2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = C.white)}
                onMouseLeave={e => (e.currentTarget.style.color = C.slate)}>
                {l.label}
              </a>
            ))}
          </div>
          <button className="btn-nav" onClick={() => router.push("/login")}>
            Empezar gratis
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ padding: "96px 24px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* glow rojo de fondo */}
        <div style={{
          position: "absolute", top: "-5%", left: "50%", transform: "translateX(-50%)",
          width: 700, height: 500,
          background: "radial-gradient(ellipse at center, rgba(170,0,0,.1) 0%, transparent 70%)",
          pointerEvents: "none",
        }}/>
        <div style={{ maxWidth: 820, margin: "0 auto", position: "relative" }}>
          {/* badge */}
          <div className="f1" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(170,0,0,.1)", border: "1px solid rgba(170,0,0,.22)",
            borderRadius: 100, padding: "6px 18px", marginBottom: 32,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.red, boxShadow: `0 0 8px ${C.red}` }}/>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.red, letterSpacing: ".12em", textTransform: "uppercase" }}>
              Actividad · Calidad de fichas · Coach IA
            </span>
          </div>

          {/* headline */}
          <h1 className="f2" style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(42px, 7vw, 76px)",
            fontWeight: 500,
            lineHeight: 1.04,
            marginBottom: 28,
            color: C.pure,
            letterSpacing: "-.03em",
          }}>
            Medí tu actividad.<br />
            Mejorá tu cartera.<br />
            <span className="red-text">Cerrá más.</span>
          </h1>

          {/* sub */}
          <p className="f3" style={{
            fontSize: "clamp(15px, 2vw, 18px)",
            color: C.mist,
            maxWidth: 580,
            margin: "0 auto 44px",
            lineHeight: 1.75,
          }}>
            InmoCoach conecta tu Google Calendar, analiza tu cartera en Tokko Broker
            y te da un diagnóstico semanal con IA. La única herramienta de productividad
            diseñada para el mercado inmobiliario argentino.
          </p>

          {/* CTAs */}
          <div className="f4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <button className="btn-primary" onClick={() => router.push("/login")}>
              Probalo 7 días gratis <ArrowRight size={14}/>
            </button>
            <a href="#como-funciona" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              Ver cómo funciona
            </a>
          </div>
          <p className="f5" style={{ fontSize: 12, color: "#444" }}>
            Sin tarjeta de crédito · Sin contrato · Cancelás cuando querés
          </p>
        </div>
      </section>

      {/* ── SCREENSHOT HERO ── */}
      <section style={{ padding: "0 24px 100px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div className="ic-screen">
            <div className="ic-screen-bar">
              {["#ff5f57","#febc2e","#28c840"].map(c => (
                <div key={c} className="ic-dot" style={{ background: c }}/>
              ))}
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,.06)", marginLeft: 8, maxWidth: 220 }}/>
            </div>
            <ScreenDashboard/>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ padding: "0 24px 100px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }} className="ic-3col">
          {[
            { num: "2 en 1", desc: "Actividad comercial + calidad de cartera en un solo dashboard" },
            { num: "15", desc: "reuniones cara a cara por semana = estándar top producer" },
            { num: "3×", desc: "más cierres logra quien mide y ajusta su semana con datos" },
            { num: "90 días", desc: "es el límite: fichas sin actualizar pierden posicionamiento" },
          ].map((s, i) => (
            <div key={i} className="stat-pill">
              <div style={{
                fontFamily: "Georgia, serif",
                fontSize: "clamp(28px,3vw,38px)",
                fontWeight: 700,
                color: C.red,
                marginBottom: 10,
                lineHeight: 1,
              }}>{s.num}</div>
              <p style={{ fontSize: 13, color: C.slate, lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section id="como-funciona" style={{ padding: "100px 24px", borderTop: "1px solid rgba(255,255,255,.05)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div className="section-label" style={{ justifyContent: "center" }}>Tres pilares</div>
            <h2 style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(30px,4vw,48px)",
              fontWeight: 500,
              lineHeight: 1.1,
              color: C.pure,
              letterSpacing: "-.02em",
            }}>
              Todo lo que necesitás,<br />
              <span className="red-text">conectado y automatizado</span>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }} className="ic-3col">
            {[
              {
                icon: <Calendar size={22} color={C.red}/>,
                num: "01", color: C.red,
                title: "Actividad comercial",
                sub: "vía Google Calendar",
                desc: "Detectamos automáticamente tus reuniones cara a cara — tasaciones, visitas, propuestas, cierres. Sin cargar nada. Calculamos tu IAC en tiempo real.",
                bullets: ["Reuniones detectadas automáticamente","IAC semanal y mensual","Racha de productividad y rangos","Alerta si tu racha está en riesgo"],
              },
              {
                icon: <Building2 size={22} color={C.mist}/>,
                num: "02", color: C.mist,
                title: "Calidad de cartera",
                sub: "vía Tokko Broker",
                desc: "Conectamos tu Tokko y analizamos cada ficha: fotos, plano, video, tour 360° y antigüedad. Sabés cuáles están perdiendo visitas por estar incompletas.",
                bullets: ["Estado de cada propiedad publicada","Alertas de fichas incompletas","Propiedades sin actualizar +90 días","Vista broker: cartera de cada agente"],
              },
              {
                icon: <Brain size={22} color={C.red}/>,
                num: "03", color: C.red,
                title: "Coach IA semanal",
                sub: "Análisis personalizado",
                desc: "Inmo Coach analiza tu actividad + el estado de tu cartera y te da un diagnóstico honesto: qué hiciste bien, dónde perdiste y cuál es la acción concreta para esta semana.",
                bullets: ["Perfil de semana (productivo / reactivo / en riesgo)","Análisis de oportunidades perdidas","Acción concreta semanal","Reporte por email todos los lunes"],
              },
            ].map((p, i) => (
              <div key={i} className="ic-card" style={{ padding: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: `${p.color}12`,
                    border: `1px solid ${p.color}25`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {p.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: p.color, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 3 }}>{p.sub}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: C.pure }}>{p.title}</div>
                  </div>
                  <div style={{ marginLeft: "auto", fontFamily: "Georgia, serif", fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,.05)", lineHeight: 1 }}>{p.num}</div>
                </div>
                <p style={{ fontSize: 13.5, color: C.slate, lineHeight: 1.75, marginBottom: 20 }}>{p.desc}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {p.bullets.map((b, j) => (
                    <div key={j} className="feature-check">
                      <CheckCircle size={13} style={{ color: p.color, flexShrink: 0, marginTop: 2 }}/>
                      <span style={{ fontSize: 12.5, color: C.mist }}>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BROKER SECTION ── */}
      <section id="para-quien" style={{ padding: "100px 24px", borderTop: "1px solid rgba(255,255,255,.05)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }} className="ic-2col">
            <div>
              <div className="section-label">Para brokers</div>
              <h2 style={{
                fontFamily: "Georgia, serif",
                fontSize: "clamp(28px,3.5vw,44px)",
                fontWeight: 500,
                lineHeight: 1.1,
                color: C.pure,
                marginBottom: 20,
                letterSpacing: "-.02em",
              }}>
                Todo tu equipo.<br />
                <span className="red-text">Un solo lugar.</span>
              </h2>
              <p style={{ fontSize: 14.5, color: C.slate, lineHeight: 1.8, marginBottom: 24 }}>
                Dashboard del equipo con ranking interno, IAC colectivo, alertas de racha en riesgo
                y estado de cartera por agente. Sabés quién necesita coaching antes de que los números lo digan.
              </p>
              {[
                "Ranking semanal de actividad con tendencia",
                "Alerta automática cuando un agente está en riesgo",
                "Cartera Tokko desglosada por agente",
                "Invitación de agentes con 1 click desde Tokko",
              ].map((f, i) => (
                <div key={i} className="feature-check">
                  <div style={{ width: 18, height: 18, borderRadius: 6, background: "rgba(170,0,0,.15)", border: "1px solid rgba(170,0,0,.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <CheckCircle size={10} style={{ color: C.red }}/>
                  </div>
                  <span style={{ fontSize: 13.5, color: C.mist }}>{f}</span>
                </div>
              ))}
            </div>
            <div className="ic-screen">
              <div className="ic-screen-bar">
                {["#ff5f57","#febc2e","#28c840"].map(c => (
                  <div key={c} className="ic-dot" style={{ background: c }}/>
                ))}
              </div>
              <ScreenTeam/>
            </div>
          </div>
        </div>
      </section>

      {/* ── AGENTE SECTION ── */}
      <section style={{ padding: "100px 24px", borderTop: "1px solid rgba(255,255,255,.05)", background: "rgba(255,255,255,.013)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }} className="ic-2col">
            <div className="ic-screen ic-hide-mobile">
              <div className="ic-screen-bar">
                {["#ff5f57","#febc2e","#28c840"].map(c => (
                  <div key={c} className="ic-dot" style={{ background: c }}/>
                ))}
              </div>
              <ScreenCartera/>
            </div>
            <div>
              <div className="section-label">Para agentes</div>
              <h2 style={{
                fontFamily: "Georgia, serif",
                fontSize: "clamp(28px,3.5vw,44px)",
                fontWeight: 500,
                lineHeight: 1.1,
                color: C.pure,
                marginBottom: 20,
                letterSpacing: "-.02em",
              }}>
                Tus fichas hablan.<br />
                <span className="red-text">¿Las estás escuchando?</span>
              </h2>
              <p style={{ fontSize: 14.5, color: C.slate, lineHeight: 1.8, marginBottom: 24 }}>
                El estándar de una ficha que convierte: 15+ fotos, plano, video o tour 360° y actualizada.
                InmoCoach lo mide por vos y te alerta cuando una propiedad está perdiendo oportunidades.
              </p>
              {[
                "Fotos, plano, video y tour 360° por propiedad",
                "Alerta de fichas incompletas con detalle",
                "Propiedades publicadas hace más de 90 días sin cambios",
                "Acceso directo a editar en Tokko desde la app",
              ].map((f, i) => (
                <div key={i} className="feature-check">
                  <div style={{ width: 18, height: 18, borderRadius: 6, background: "rgba(170,0,0,.15)", border: "1px solid rgba(170,0,0,.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <CheckCircle size={10} style={{ color: C.red }}/>
                  </div>
                  <span style={{ fontSize: 13.5, color: C.mist }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ROLES ── */}
      <section style={{ padding: "100px 24px", borderTop: "1px solid rgba(255,255,255,.05)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div className="section-label" style={{ justifyContent: "center" }}>Diseñado para cada rol</div>
            <h2 style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(28px,4vw,46px)",
              fontWeight: 500,
              lineHeight: 1.1,
              color: C.pure,
              letterSpacing: "-.02em",
            }}>Encontrá tu lugar<br /><span className="red-text">en InmoCoach</span></h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {[
              { icon: "◈", title: "Agente independiente", desc: "Tu IAC semanal, racha de productividad, ranking global y el estado de tu cartera Tokko. El espejo que nunca tuviste.", items: ["Dashboard personal","IAC y racha","Coach IA semanal","Cartera Tokko"] },
              { icon: "⊞", title: "Broker con equipo", desc: "Actividad individual + colectiva, cartera por agente, alertas automáticas. Hacés coaching con datos, no con sensaciones.", items: ["Dashboard de equipo","Ranking interno","Cartera por agente","Alertas de racha"] },
              { icon: "✦", title: "Team leader", desc: "Visibilidad de tu subequipo dentro de la organización. Sabés quién va bien y quién necesita apoyo esta semana.", items: ["Vista de tu grupo","Ranking comparativo","Historial por agente","Acceso a carteras"] },
            ].map((r, i) => (
              <div key={i} className="ic-card" style={{ padding: 28 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(170,0,0,.1)", border: "1px solid rgba(170,0,0,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 16, color: C.red }}>
                  {r.icon}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.pure, marginBottom: 10 }}>{r.title}</div>
                <p style={{ fontSize: 13.5, color: C.slate, lineHeight: 1.7, marginBottom: 20 }}>{r.desc}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {r.items.map((item, j) => (
                    <span key={j} style={{ fontSize: 11, fontWeight: 600, background: "rgba(170,0,0,.1)", color: C.red, border: "1px solid rgba(170,0,0,.18)", borderRadius: 6, padding: "3px 10px" }}>{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ── */}
      <section style={{ padding: "100px 24px", borderTop: "1px solid rgba(255,255,255,.05)", background: "rgba(255,255,255,.013)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div className="section-label" style={{ justifyContent: "center" }}>Resultados reales</div>
            <h2 style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(28px,4vw,46px)",
              fontWeight: 500,
              lineHeight: 1.1,
              color: C.pure,
              letterSpacing: "-.02em",
            }}>Lo que dicen los que<br /><span className="red-text">ya miden</span></h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            {[
              { name: "Marcela R.", role: "Agente independiente, CABA", text: "Siempre creí que era productiva. Cuando empecé a medir me di cuenta que el 70% de mis reuniones eran administrativas. Eso cambió todo." },
              { name: "Rodrigo T.", role: "Broker con 12 agentes, GBA", text: "El dashboard del equipo es lo mejor. Ahora sé exactamente quién necesita ayuda sin esperar a fin de mes para verlo en los números." },
              { name: "Valeria M.", role: "Agente, Córdoba", text: "Tenía fichas publicadas hacía más de 6 meses sin tocar. InmoCoach me las marcó y en una semana actualicé todo. Recibí 3 consultas más en 2 días." },
            ].map((t, i) => (
              <div key={i} className="ic-card" style={{ padding: 28 }}>
                <div style={{ color: C.red, fontSize: 40, fontFamily: "Georgia, serif", lineHeight: 1, marginBottom: 16, opacity: .6 }}>"</div>
                <p style={{ fontSize: 14, color: C.mist, lineHeight: 1.8, marginBottom: 24 }}>{t.text}</p>
                <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(170,0,0,.15)", border: "1px solid rgba(170,0,0,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: C.red }}>
                    {t.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.pure }}>{t.name}</div>
                    <div style={{ fontSize: 11.5, color: C.slate, marginTop: 2 }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRECIOS ── */}
      <section style={{ padding: "100px 24px", borderTop: "1px solid rgba(255,255,255,.05)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <div className="section-label" style={{ justifyContent: "center" }}>Precios</div>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(28px,4vw,46px)",
            fontWeight: 500,
            lineHeight: 1.1,
            color: C.pure,
            marginBottom: 16,
            letterSpacing: "-.02em",
          }}>
            Empezás gratis.<br />
            <span className="red-text">El precio crece con tu equipo.</span>
          </h2>
          <p style={{ color: C.slate, fontSize: 14.5, marginBottom: 48, lineHeight: 1.75 }}>
            7 días sin tarjeta. Individual desde <strong style={{ color: C.white }}>$10.500/mes</strong>.
            Equipos con descuento por volumen — cuantos más agentes, menos pagás por cada uno.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 48 }} className="ic-4col">
            {[
              { range: "1 agente", price: "$10.500", label: "Individual" },
              { range: "5–9 agentes", price: "$8.400", label: "−20%" },
              { range: "10–19 agentes", price: "$7.350", label: "−30%" },
              { range: "20+ agentes", price: "$6.300", label: "−40%" },
            ].map((t, i) => (
              <div key={i} className="ic-card" style={{ padding: "20px 12px" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "clamp(18px,2vw,24px)", fontWeight: 700, color: C.red, marginBottom: 6 }}>{t.price}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.mist, marginBottom: 6 }}>{t.range}</div>
                <div style={{ display: "inline-block", fontSize: 10, fontWeight: 700, background: "rgba(170,0,0,.1)", color: C.red, border: "1px solid rgba(170,0,0,.2)", borderRadius: 6, padding: "2px 8px" }}>{t.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => router.push("/pricing")}>
              Ver precios y simulador <ArrowRight size={14}/>
            </button>
            <button className="btn-ghost" onClick={() => router.push("/login")}>
              Empezar gratis 7 días
            </button>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ padding: "100px 24px", borderTop: "1px solid rgba(255,255,255,.05)", position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", bottom: "-20%", left: "50%", transform: "translateX(-50%)",
          width: 600, height: 400,
          background: "radial-gradient(ellipse at center, rgba(170,0,0,.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}/>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", position: "relative" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(170,0,0,.12)", border: "1px solid rgba(170,0,0,.22)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px" }}>
            <TrendingUp size={24} color={C.red}/>
          </div>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(30px,5vw,52px)",
            fontWeight: 500,
            lineHeight: 1.08,
            color: C.pure,
            marginBottom: 20,
            letterSpacing: "-.03em",
          }}>
            El próximo lunes vas a saber<br />
            <span className="red-text">exactamente cómo estás</span>
          </h2>
          <p style={{ fontSize: 15, color: C.slate, marginBottom: 40, lineHeight: 1.75, maxWidth: 480, margin: "0 auto 40px" }}>
            Conectás tu Google Calendar hoy. El lunes siguiente recibís tu primer análisis
            de actividad, con el estado de tu cartera incluido.
          </p>
          <button className="btn-primary" onClick={() => router.push("/login")} style={{ fontSize: 15, padding: "15px 36px" }}>
            Empezar 7 días gratis <ArrowRight size={16}/>
          </button>
          <p style={{ marginTop: 16, fontSize: 12, color: "#333" }}>
            Sin tarjeta · Sin contrato · Cancelás cuando querés
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,.06)", padding: "32px 24px", background: C.ink }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
          <div style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 16, color: C.pure, letterSpacing: "-.02em" }}>
            Inmo<span className="red-text">Coach</span>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[
              { label: "Política de privacidad", href: "/privacidad" },
              { label: "Términos de uso", href: "/terminos" },
              { label: "Iniciar sesión", href: "/login" },
            ].map(l => (
              <a key={l.label} href={l.href} style={{ color: C.slate, fontSize: 12, transition: "color .2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = C.mist)}
                onMouseLeave={e => (e.currentTarget.style.color = C.slate)}>
                {l.label}
              </a>
            ))}
          </div>
          <p style={{ color: "#333", fontSize: 12, margin: 0 }}>© 2025 InmoCoach · inmocoach.com.ar</p>
        </div>
      </footer>
    </div>
  );
}
