import Head from "next/head";
import { useRouter } from "next/router";

const RED = "#aa0000";

export default function Terminos() {
  const router = useRouter();
  return (
    <div style={{ background: "#fff", minHeight: "100vh", fontFamily: "'Georgia', serif", color: "#111" }}>
      <Head>
        <title>Términos de Uso — InstaCoach</title>
      </Head>
      <div style={{ height: 3, background: RED }} />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px" }}>
        <button onClick={() => router.push("/home")} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 13, fontFamily: "sans-serif", marginBottom: 40, display: "flex", alignItems: "center", gap: 6 }}>
          ← Volver
        </button>

        <div style={{ fontFamily: "sans-serif", fontSize: 12, color: RED, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Legal</div>
        <h1 style={{ fontSize: 40, lineHeight: 1.1, marginBottom: 8 }}>Términos de Uso</h1>
        <p style={{ color: "#999", fontSize: 14, fontFamily: "sans-serif", marginBottom: 48 }}>Última actualización: enero 2025 · InstaCoach · instacoach.com.ar</p>

        {[
          {
            title: "1. Aceptación de los términos",
            body: `Al crear una cuenta y usar InstaCoach, aceptás estos términos en su totalidad. Si no estás de acuerdo con alguna parte, no podés usar el servicio. El uso continuado del servicio implica la aceptación de cualquier actualización de estos términos.`
          },
          {
            title: "2. Descripción del servicio",
            body: `InstaCoach es una plataforma SaaS que sincroniza tu Google Calendar para detectar reuniones comerciales cara a cara, medir tu productividad y generar análisis personalizados mediante inteligencia artificial. El servicio incluye dashboard de actividad, reporte semanal por email y, según el plan, funcionalidades de equipo para brokers.`
          },
          {
            title: "3. Registro y cuenta",
            body: `Para usar InstaCoach necesitás una cuenta de Google válida. Sos responsable de mantener la confidencialidad de tu sesión. Cada cuenta es personal e intransferible. No podés compartir tu acceso con otras personas ni crear cuentas múltiples para un mismo usuario.`
          },
          {
            title: "4. Planes y pagos",
            body: `InstaCoach ofrece un período de prueba gratuito de 7 días con acceso completo. Una vez vencido el período de prueba, el acceso requiere una suscripción mensual activa. Los precios están expresados en dólares estadounidenses (USD) y se cobran en pesos argentinos al tipo de cambio oficial vigente al momento del cobro, procesados por MercadoPago. Las suscripciones se renuevan automáticamente cada mes. Podés cancelar en cualquier momento desde tu cuenta de MercadoPago.`
          },
          {
            title: "5. Política de reembolsos",
            body: `Dado que ofrecemos 7 días de prueba gratuita sin restricciones, no ofrecemos reembolsos una vez procesado el pago. Si tenés problemas con el servicio, escribinos a hola@instacoach.com.ar y lo resolvemos.`
          },
          {
            title: "6. Uso aceptable",
            body: `Podés usar InstaCoach para gestionar tu actividad comercial personal y de tu equipo. No podés usar el servicio para actividades ilegales, revender el acceso a terceros, intentar acceder a datos de otros usuarios, hacer ingeniería inversa del software ni sobrecargar los servidores con solicitudes automatizadas.`
          },
          {
            title: "7. Propiedad intelectual",
            body: `InstaCoach y todos sus componentes (software, diseño, textos, marca) son propiedad de sus creadores y están protegidos por las leyes de propiedad intelectual argentinas e internacionales. Los datos de tu actividad comercial son tuyos — InstaCoach no reclama propiedad sobre ellos.`
          },
          {
            title: "8. Disponibilidad del servicio",
            body: `Nos esforzamos por mantener InstaCoach disponible el 99% del tiempo, pero no garantizamos disponibilidad ininterrumpida. Podemos realizar mantenimientos programados notificando con anticipación. No somos responsables por pérdidas derivadas de interrupciones del servicio.`
          },
          {
            title: "9. Limitación de responsabilidad",
            body: `InstaCoach es una herramienta de medición y análisis. El análisis de Insta Coach es orientativo y no reemplaza el criterio profesional del usuario. No somos responsables por decisiones comerciales tomadas en base al análisis del servicio. La responsabilidad máxima de InstaCoach ante cualquier reclamo no superará el monto abonado en los últimos 3 meses de suscripción.`
          },
          {
            title: "10. Cancelación y cierre de cuenta",
            body: `Podés cancelar tu suscripción en cualquier momento. Al cancelar, mantenés acceso hasta el fin del período pago. Podés solicitar el cierre completo de tu cuenta escribiendo a hola@instacoach.com.ar. Nos reservamos el derecho de suspender cuentas que violen estos términos.`
          },
          {
            title: "11. Ley aplicable",
            body: `Estos términos se rigen por las leyes de la República Argentina. Cualquier disputa será resuelta en los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires, con renuncia expresa a cualquier otro fuero.`
          },
          {
            title: "12. Contacto",
            body: `Para consultas sobre estos términos, escribinos a hola@instacoach.com.ar.`
          },
        ].map((s, i) => (
          <div key={i} style={{ marginBottom: 36, paddingBottom: 36, borderBottom: "1px solid #f0f0f0" }}>
            <h2 style={{ fontSize: 20, marginBottom: 12, fontFamily: "Georgia, serif" }}>{s.title}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: "#444", fontFamily: "sans-serif" }}>{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
