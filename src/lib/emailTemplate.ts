interface WeeklyReportData {
  userName: string;
  email: string;
  weekDates: string;
  weekStart?: string; // YYYY-MM-DD para deep link
  greenTotal: number;
  tasaciones: number;
  visitas: number;
  propuestas: number;
  cierres?: number;
  productiveDays: number;
  totalDays: number;
  productivityRate: number;
  coachAdvice: string;
  planName: string;
  isExpiringSoon?: boolean;
  daysLeft?: number;
  streak?: number;
  rankSlug?: string;
  rankLabel?: string;
  rankIcon?: string;
  nextRankLabel?: string;
  nextRankMinWeeks?: number;
  nextRankMinIac?: number;
  activeWeeks?: number;
  iacAvg?: number;
}

export function generateWeeklyEmailHtml(data: WeeklyReportData): string {
  const {
    userName, weekDates, greenTotal, tasaciones, visitas, propuestas, cierres = 0,
    productiveDays, totalDays, productivityRate, coachAdvice,
    planName, isExpiringSoon, daysLeft, streak = 0,
    rankSlug = "junior", rankLabel = "Agente Junior", rankIcon = "🏠",
    nextRankLabel, nextRankMinWeeks, nextRankMinIac, activeWeeks = 0, iacAvg = 0,
  } = data;

  const firstName = userName?.split(" ")[0] ?? "Inmobiliario";
  const rateColor = productivityRate >= 60 ? "#16a34a" : productivityRate >= 40 ? "#d97706" : "#aa0000";
  const rateLabel = productivityRate >= 60 ? "Semana productiva" : productivityRate >= 40 ? "Semana en construcción" : "Semana para activar";

  const expireBanner = isExpiringSoon ? `
    <tr>
      <td style="padding:0 32px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#fff8f8;border:1px solid #fca5a5;border-radius:12px;padding:16px 20px;">
          <tr><td>
            <p style="margin:0;font-size:13px;font-weight:700;color:#aa0000;">
              Te quedan ${daysLeft} día${daysLeft === 1 ? "" : "s"} de prueba gratuita.
              <a href="https://inmocoach.com.ar/pricing" style="color:#aa0000;text-decoration:underline;margin-left:6px;">Activá tu plan →</a>
            </p>
          </td></tr>
        </table>
      </td>
    </tr>
  ` : "";

  const kpi = (value: number, label: string) => `
    <td style="padding:0 4px;">
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:16px 12px;text-align:center;">
        <tr><td>
          <p style="margin:0;font-family:Georgia,serif;font-size:28px;font-weight:900;color:#111827;">${value}</p>
          <p style="margin:5px 0 0;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">${label}</p>
        </td></tr>
      </table>
    </td>
  `;

  // Parsear las 3 secciones del coach advice (separadas por \n\n o saltos dobles)
  const adviceParts = coachAdvice.split(/\n\n+/).filter(Boolean);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu informe semanal — InmoCoach</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Barra roja superior -->
        <tr>
          <td style="background:#aa0000;height:5px;border-radius:12px 12px 0 0;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- Header logo -->
        <tr>
          <td style="background:#ffffff;padding:28px 32px 20px;border-bottom:1px solid #f3f4f6;">
            <p style="margin:0;font-family:Georgia,serif;font-size:26px;font-weight:900;color:#111827;line-height:1;">
              Inmo<span style="color:#aa0000;">Coach</span>
            </p>
            <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;font-weight:500;letter-spacing:0.5px;">
              Tu informe semanal · ${weekDates}
            </p>
          </td>
        </tr>

        <!-- Saludo -->
        <tr>
          <td style="background:#ffffff;padding:24px 32px 8px;">
            <p style="margin:0;font-family:Georgia,serif;font-size:20px;font-weight:900;color:#111827;">
              Hola, ${firstName}.
            </p>
            <p style="margin:6px 0 0;font-size:14px;color:#6b7280;">
              Esta es tu actividad comercial de la semana. Plan <strong>${planName}</strong>.
            </p>
          </td>
        </tr>

        <!-- Banner vencimiento si aplica -->
        ${expireBanner}

        <!-- Productividad -->
        <tr>
          <td style="background:#ffffff;padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px;padding:22px 24px;">
              <tr>
                <td style="vertical-align:middle;">
                  <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">
                    Productividad de la semana
                  </p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:46px;font-weight:900;color:${rateColor};line-height:1;">
                    ${productivityRate}%
                  </p>
                  <p style="margin:6px 0 0;font-size:13px;font-weight:600;color:${rateColor};">
                    ${rateLabel} — ${productiveDays} de ${totalDays} días
                  </p>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <table cellpadding="0" cellspacing="0"
                    style="background:#aa0000;border-radius:14px;padding:14px 20px;text-align:center;display:inline-table;">
                    <tr><td>
                      <p style="margin:0;font-family:Georgia,serif;font-size:34px;font-weight:900;color:#ffffff;line-height:1;">${greenTotal}</p>
                      <p style="margin:5px 0 0;font-size:10px;font-weight:700;color:#ffcccc;text-transform:uppercase;letter-spacing:1px;">reuniones</p>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- KPIs -->
        <tr>
          <td style="background:#ffffff;padding:0 28px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${kpi(tasaciones, "Tasaciones")}
                ${kpi(visitas, "Visitas")}
                ${kpi(propuestas, "Propuestas")}
                ${kpi(cierres, "Cierres")}
              </tr>
            </table>
          </td>
        </tr>

        <!-- Racha -->
        ${streak > 0 ? `
        <tr>
          <td style="padding:0 32px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:${streak >= 5 ? "#fff7ed" : "#fef2f2"};border:1px solid ${streak >= 5 ? "#fed7aa" : "#fecaca"};border-radius:12px;padding:14px 20px;">
              <tr>
                <td>
                  <p style="margin:0;font-size:13px;font-weight:700;color:${streak >= 5 ? "#ea580c" : "#aa0000"};">
                    ${streak >= 5 ? "🔥" : "⚡"} Racha activa: <strong>${streak} días consecutivos</strong>
                    ${streak >= 10 ? " — ¡récord en camino!" : streak >= 5 ? " — seguí así" : " — no la rompas"}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ` : `
        <tr>
          <td style="padding:0 32px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px 20px;">
              <tr>
                <td>
                  <p style="margin:0;font-size:13px;color:#9ca3af;">
                    💤 Sin racha activa — agendá al menos 2 reuniones por día para arrancar
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        `}

        <!-- Rango -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="border:1px solid #e5e7eb;border-radius:16px;padding:20px 24px;background:#f9fafb;">
              <tr>
                <td>
                  <p style="margin:0 0 4px;font-size:10px;font-weight:900;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;">Tu rango actual</p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:900;color:#111827;line-height:1;">
                    ${rankIcon} ${rankLabel}
                  </p>
                  <p style="margin:6px 0 0;font-size:12px;color:#6b7280;">
                    ${activeWeeks} semana${activeWeeks !== 1 ? "s" : ""} activa${activeWeeks !== 1 ? "s" : ""} · IAC promedio ${iacAvg}%
                  </p>
                  ${nextRankLabel ? `
                  <p style="margin:10px 0 0;font-size:11px;color:#9ca3af;">
                    Próximo: <strong style="color:#111827;">${nextRankLabel}</strong> — ${nextRankMinWeeks} semanas + IAC prom. ≥ ${nextRankMinIac}%
                    &nbsp;·&nbsp; <a href="https://inmocoach.com.ar/rangos" style="color:#aa0000;text-decoration:none;">Ver todos los rangos →</a>
                  </p>` : `
                  <p style="margin:10px 0 0;font-size:11px;font-weight:700;color:#aa0000;">
                    👑 Nivel máximo alcanzado — sos un Master Broker
                  </p>`}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Inmo Coach -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="border:1px solid #e5e7eb;border-left:4px solid #aa0000;border-radius:0 12px 12px 0;padding:20px 22px;background:#ffffff;">
              <tr>
                <td>
                  <p style="margin:0 0 14px;font-size:10px;font-weight:900;color:#aa0000;text-transform:uppercase;letter-spacing:2px;">
                    Inmo<span style="color:#aa0000;">Coach</span>
                  </p>
                  ${adviceParts.map((part, i) => `
                    <p style="margin:0 0 ${i < adviceParts.length - 1 ? "12px" : "0"};font-size:14px;color:#374151;line-height:1.75;font-weight:${i === 0 ? "600" : "400"};">
                      ${part.replace(/\n/g, "<br>")}
                    </p>
                  `).join("")}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 32px;text-align:center;">
            <a href="https://inmocoach.com.ar${data.weekStart ? "?week=" + data.weekStart : ""}"
              style="display:inline-block;background:#aa0000;color:#ffffff;font-weight:900;font-size:14px;padding:15px 36px;border-radius:12px;text-decoration:none;letter-spacing:0.5px;">
              Ver mi dashboard completo →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:24px 32px;text-align:center;">
            <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:14px;font-weight:900;color:#111827;">
              Inmo<span style="color:#aa0000;">Coach</span>
            </p>
            <p style="margin:0 0 6px;font-size:11px;color:#9ca3af;line-height:1.7;">
              Este es un email automático — por favor no respondas este mensaje.<br>
              Para consultas escribí a <a href="mailto:hola@inmocoach.com.ar" style="color:#aa0000;text-decoration:none;">hola@inmocoach.com.ar</a>
            </p>
            <p style="margin:0;font-size:11px;color:#d1d5db;">
              Recibís este mail porque usás InmoCoach ·
              <a href="https://inmocoach.com.ar" style="color:#9ca3af;text-decoration:none;">inmocoach.com.ar</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function generateWelcomeEmailHtml(userName: string): string {
  const firstName = userName?.split(" ")[0] ?? "Inmobiliario";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a InmoCoach</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Barra roja top -->
        <tr>
          <td style="background:#aa0000;height:5px;border-radius:12px 12px 0 0;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- Header logo -->
        <tr>
          <td style="background:#ffffff;padding:32px 40px 24px;border-bottom:1px solid #f3f4f6;">
            <p style="margin:0;font-family:Georgia,serif;font-size:28px;font-weight:900;color:#111827;line-height:1;">
              Inmo<span style="color:#aa0000;">Coach</span>
            </p>
            <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;">
              Tu coach de productividad inmobiliaria
            </p>
          </td>
        </tr>

        <!-- Saludo hero -->
        <tr>
          <td style="background:#ffffff;padding:36px 40px 8px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#aa0000;text-transform:uppercase;letter-spacing:2px;">
              Bienvenido al equipo
            </p>
            <p style="margin:0;font-family:Georgia,serif;font-size:30px;font-weight:900;color:#111827;line-height:1.2;">
              Hola, ${firstName}.<br/>Ya estás dentro.
            </p>
            <p style="margin:16px 0 0;font-size:15px;color:#374151;line-height:1.8;">
              InmoCoach ya está leyendo tu Google Calendar y midiendo tu actividad comercial
              en tiempo real. Sin cargar nada manualmente — solo agendá como siempre.
            </p>
          </td>
        </tr>

        <!-- Separador -->
        <tr>
          <td style="background:#ffffff;padding:24px 40px 0;">
            <div style="height:1px;background:#f3f4f6;"></div>
          </td>
        </tr>

        <!-- Objetivo principal -->
        <tr>
          <td style="background:#ffffff;padding:28px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#aa0000;border-radius:16px;padding:28px 32px;">
              <tr>
                <td>
                  <p style="margin:0 0 8px;font-size:11px;font-weight:900;color:#ffcccc;text-transform:uppercase;letter-spacing:2px;">
                    Tu primer objetivo
                  </p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:28px;font-weight:900;color:#ffffff;line-height:1.25;">
                    3 reuniones cara a cara<br/>por día. 15 en la semana.
                  </p>
                  <p style="margin:12px 0 0;font-size:14px;color:#ffcccc;line-height:1.6;">
                    Eso es <strong style="color:#ffffff;">IAC 100%</strong> — el nivel de actividad
                    de un Top Producer inmobiliario.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- 3 KPIs -->
        <tr>
          <td style="background:#ffffff;padding:0 40px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:0 5px 0 0;width:33%;">
                  <table width="100%" cellpadding="0" cellspacing="0"
                    style="background:#fef2f2;border:1px solid #fecaca;border-radius:14px;padding:20px 16px;text-align:center;">
                    <tr><td>
                      <p style="margin:0;font-family:Georgia,serif;font-size:34px;font-weight:900;color:#aa0000;">15</p>
                      <p style="margin:6px 0 0;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">reuniones<br/>por semana</p>
                    </td></tr>
                  </table>
                </td>
                <td style="padding:0 2.5px;width:33%;">
                  <table width="100%" cellpadding="0" cellspacing="0"
                    style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:20px 16px;text-align:center;">
                    <tr><td>
                      <p style="margin:0;font-family:Georgia,serif;font-size:34px;font-weight:900;color:#111827;">3</p>
                      <p style="margin:6px 0 0;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">por día<br/>lun a vie</p>
                    </td></tr>
                  </table>
                </td>
                <td style="padding:0 0 0 5px;width:33%;">
                  <table width="100%" cellpadding="0" cellspacing="0"
                    style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:20px 16px;text-align:center;">
                    <tr><td>
                      <p style="margin:0;font-family:Georgia,serif;font-size:34px;font-weight:900;color:#111827;">6→1</p>
                      <p style="margin:6px 0 0;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">procesos<br/>por operación</p>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Cómo funciona -->
        <tr>
          <td style="background:#ffffff;padding:0 40px 28px;">
            <p style="margin:0 0 16px;font-size:11px;font-weight:900;color:#6b7280;text-transform:uppercase;letter-spacing:2px;">
              Cómo funciona
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #f3f4f6;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:32px;vertical-align:top;">
                        <p style="margin:0;font-size:18px;">📅</p>
                      </td>
                      <td style="padding-left:12px;">
                        <p style="margin:0;font-size:13px;font-weight:700;color:#111827;">Agendá tus reuniones en Google Calendar</p>
                        <p style="margin:4px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">Usá palabras como Tasación, Visita, Reunión o pintá el evento de verde.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #f3f4f6;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:32px;vertical-align:top;">
                        <p style="margin:0;font-size:18px;">📊</p>
                      </td>
                      <td style="padding-left:12px;">
                        <p style="margin:0;font-size:13px;font-weight:700;color:#111827;">InmoCoach calcula tu IAC automáticamente</p>
                        <p style="margin:4px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">Tu Índice de Actividad Comercial se actualiza cada vez que abrís el dashboard.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:32px;vertical-align:top;">
                        <p style="margin:0;font-size:18px;">📬</p>
                      </td>
                      <td style="padding-left:12px;">
                        <p style="margin:0;font-size:13px;font-weight:700;color:#111827;">Cada lunes recibís tu informe semanal</p>
                        <p style="margin:4px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">Con tus números de la semana y un consejo personalizado de Inmo<strong>Coach</strong>.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:#ffffff;padding:0 40px 40px;text-align:center;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
              Tu dashboard ya tiene datos de tu calendario.<br/>
              <strong>Fijate dónde estás parado hoy.</strong>
            </p>
            <a href="https://inmocoach.com.ar"
              style="display:inline-block;background:#aa0000;color:#ffffff;font-weight:900;font-size:15px;padding:16px 40px;border-radius:14px;text-decoration:none;letter-spacing:0.5px;">
              Ver mi dashboard →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:28px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:15px;font-weight:900;color:#111827;">
              Inmo<span style="color:#aa0000;">Coach</span>
            </p>
            <p style="margin:0 0 6px;font-size:11px;color:#9ca3af;line-height:1.7;">
              Este es un email automático — por favor no respondas este mensaje.<br>
              Para consultas escribí a <a href="mailto:hola@inmocoach.com.ar" style="color:#aa0000;text-decoration:none;">hola@inmocoach.com.ar</a>
            </p>
            <p style="margin:0;font-size:11px;color:#d1d5db;">
              Recibís este mail porque te registraste en InmoCoach ·
              <a href="https://inmocoach.com.ar" style="color:#9ca3af;text-decoration:none;">inmocoach.com.ar</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
