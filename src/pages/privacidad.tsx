import Head from "next/head";
import { useRouter } from "next/router";

const RED = "#aa0000";

export default function Privacidad() {
  const router = useRouter();
  return (
    <div style={{ background: "#fff", minHeight: "100vh", fontFamily: "'Georgia', serif", color: "#111" }}>
      <Head>
        <title>Política de Privacidad — InstaCoach</title>
      </Head>
      <div style={{ height: 3, background: RED }} />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px" }}>
        <button onClick={() => router.push("/home")} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 13, fontFamily: "sans-serif", marginBottom: 40, display: "flex", alignItems: "center", gap: 6 }}>
          ← Volver
        </button>

        <div style={{ fontFamily: "sans-serif", fontSize: 12, color: RED, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Legal</div>
        <h1 style={{ fontSize: 40, lineHeight: 1.1, marginBottom: 8 }}>Política de Privacidad</h1>
        <p style={{ color: "#999", fontSize: 14, fontFamily: "sans-serif", marginBottom: 48 }}>Última actualización: enero 2025 · InstaCoach · instacoach.com.ar</p>

        {[
          {
            title: "1. Quiénes somos",
            body: `InstaCoach es un servicio de seguimiento de productividad comercial para el sector inmobiliario, operado desde la República Argentina. Podés contactarnos en hola@instacoach.com.ar.`
          },
          {
            title: "2. Qué datos recopilamos",
            body: `Al conectar tu cuenta de Google, accedemos únicamente a tu calendario (lectura, sin modificación) para detectar tus reuniones comerciales. Guardamos tu nombre, email y foto de perfil que Google nos provee al autenticarte. No accedemos a tu email, documentos, ni ningún otro servicio de Google.`
          },
          {
            title: "3. Para qué usamos tus datos",
            body: `Usamos tu información exclusivamente para: mostrar tu dashboard de productividad, generar el análisis semanal de Insta Coach, enviarte el reporte semanal por email y gestionar tu suscripción. No compartimos ni vendemos tus datos con terceros.`
          },
          {
            title: "4. Almacenamiento y seguridad",
            body: `Tus datos se almacenan en servidores de Supabase (región São Paulo, Brasil) con cifrado en tránsito y en reposo. Los tokens de acceso a Google Calendar se guardan de forma segura y se usan exclusivamente para sincronizar tu agenda. No almacenamos contraseñas — el acceso se gestiona mediante OAuth 2.0 de Google.`
          },
          {
            title: "5. Retención de datos",
            body: `Conservamos tus datos mientras tu cuenta esté activa. Si cancelás tu suscripción o solicitás la eliminación de tu cuenta, eliminamos todos tus datos dentro de los 30 días siguientes. Para solicitar la eliminación, escribinos a hola@instacoach.com.ar.`
          },
          {
            title: "6. Servicios de terceros",
            body: `InstaCoach utiliza los siguientes servicios externos: Google OAuth y Calendar API (autenticación y lectura de agenda), MercadoPago (procesamiento de pagos — no almacenamos datos de tarjetas), Resend (envío de emails transaccionales) y Anthropic Claude (generación del análisis de IA — procesamos tu información de actividad, no datos personales identificatorios).`
          },
          {
            title: "7. Tus derechos",
            body: `Tenés derecho a acceder a tus datos, corregir información incorrecta, solicitar la eliminación de tu cuenta y datos, exportar tu información y revocar el acceso a Google Calendar desde tu cuenta de Google en cualquier momento. Para ejercer cualquiera de estos derechos, escribinos a hola@instacoach.com.ar.`
          },
          {
            title: "8. Cookies",
            body: `Usamos únicamente cookies de sesión necesarias para mantener tu sesión activa. No usamos cookies de seguimiento ni publicidad.`
          },
          {
            title: "9. Cambios en esta política",
            body: `Si realizamos cambios significativos en esta política, te notificaremos por email con al menos 15 días de anticipación. El uso continuado del servicio después de los cambios implica tu aceptación.`
          },
          {
            title: "10. Contacto",
            body: `Para cualquier consulta sobre privacidad, escribinos a hola@instacoach.com.ar. Respondemos en un plazo máximo de 5 días hábiles.`
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
