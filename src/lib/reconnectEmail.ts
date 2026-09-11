// Mail que se envia cuando un usuario con plan activo perdio la conexion
// con Google Calendar. Sin calendario no hay datos, asi que en vez de mandar
// un informe vacio le pedimos que reconecte.
export function buildReconnectEmailHtml(firstName: string): string {
  const RED = "#aa0000";
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Reconecta tu calendario</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <tr><td style="background:${RED};height:5px;border-radius:12px 12px 0 0;font-size:0;">&nbsp;</td></tr>

      <tr>
        <td style="background:#fff;padding:24px 32px 12px;border-bottom:1px solid #f3f4f6;">
          <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:900;color:#111827;">
            Inmo<span style="color:${RED};">Coach</span>
          </p>
        </td>
      </tr>

      <tr>
        <td style="background:#fff;padding:26px 32px 0;">
          <p style="margin:0;font-family:Georgia,serif;font-size:20px;font-weight:900;color:#111827;">
            Hola, ${firstName}.
          </p>
        </td>
      </tr>

      <tr>
        <td style="background:#fff;padding:12px 32px 20px;">
          <p style="margin:0 0 15px;font-size:15px;line-height:1.75;color:#374151;">
            Se desconecto tu Google Calendar, asi que esta semana no pude ver tu actividad ni prepararte el informe.
          </p>
          <p style="margin:0 0 15px;font-size:15px;line-height:1.75;color:#374151;">
            Pasa cada tanto: Google corta el permiso por seguridad y hay que volver a darlo. Se resuelve en diez segundos y no perdes nada de tu historial.
          </p>
          <p style="margin:0;font-size:15px;line-height:1.75;color:#374151;">
            Entra y reconecta, y el lunes que viene volves a recibir tu informe normal.
          </p>
        </td>
      </tr>

      <tr>
        <td style="background:#fff;padding:0 32px 28px;text-align:center;">
          <a href="https://www.inmocoach.com.ar/relogin"
            style="display:inline-block;background:${RED};color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:15px 34px;border-radius:12px;">
            Reconectar mi calendario
          </a>
          <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
            Tu plan sigue activo. Solo falta volver a dar el permiso.
          </p>
        </td>
      </tr>

      <tr>
        <td style="background:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-family:Georgia,serif;font-size:13px;color:#111827;">Inmo<span style="color:${RED};">Coach</span></p>
          <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">
            Mail automatico &middot; <a href="https://www.inmocoach.com.ar" style="color:#9ca3af;">inmocoach.com.ar</a>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}
