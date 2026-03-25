import { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";
import { supabaseAdmin } from "../../../lib/supabase";
import { getAppConfig } from "../../../lib/appConfig";
import { DEFAULT_MIDWEEK_PROMPT } from "../admin/midweek-prompt";
import { getAgentTokkoStats } from "../../../lib/tokkoPortfolio";

export const config = { maxDuration: 120 };

const resend = new Resend(process.env.RESEND_API_KEY!);

async function generateMidweekAdvice(prompt: string): Promise<string> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return data.content?.map((b: any) => b.text || "").join("") ||
      "Todavía hay tiempo esta semana. Agendá 3 reuniones para mañana y llegás al viernes con actividad real.";
  } catch {
    return "Todavía hay tiempo esta semana. Agendá 3 reuniones para mañana y llegás al viernes con actividad real.";
  }
}

function buildHtml(params: {
  firstName: string;
  greenCount: number;
  minGreens: number;
  weeklyGoal: number;
  advice: string;
  tokkoTotal?: number;
  tokkoNeedAction?: number;
  tokkoTop3?: { title: string; address: string; issues: string[]; editUrl: string }[];
}): string {
  const { firstName, greenCount, minGreens, weeklyGoal, advice, tokkoTotal, tokkoNeedAction, tokkoTop3 } = params;
  const RED = "#aa0000";
  const pct = Math.min(100, Math.round((greenCount / minGreens) * 100));
  const barColor = pct >= 100 ? "#16a34a" : pct >= 50 ? "#d97706" : RED;
  const missing = Math.max(0, minGreens - greenCount);

  const adviceParts = advice.split(/\n\n+/).filter(Boolean);

  const kpi = (value: string | number, label: string) => `
    <td style="padding:0 4px;">
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:16px 12px;text-align:center;">
        <tr><td>
          <p style="margin:0;font-family:Georgia,serif;font-size:28px;font-weight:900;color:#111827;">${value}</p>
          <p style="margin:5px 0 0;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">${label}</p>
        </td></tr>
      </table>
    </td>`;


  // Tokko section — shown only if there are properties needing action
  const tokkoSection = (tokkoTotal !== undefined && (tokkoNeedAction ?? 0) > 0 && tokkoTop3?.length) ? `
        <!-- Cartera Tokko -->
        <tr>
          <td style="padding:0 32px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="background:#111827;padding:14px 20px;">
                  <p style="margin:0;font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:2px;">&#127968; Cartera Tokko</p>
                  <p style="margin:4px 0 0;font-size:14px;color:#fff;">
                    <span style="font-family:Georgia,serif;font-size:24px;font-weight:900;color:#aa0000;">${tokkoNeedAction}</span>
                    de ${tokkoTotal} propiedades necesitan atenci&#243;n
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:0;">
                  ${(tokkoTop3 || []).map((prop, idx) => `
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f3f4f6;">
                    <tr>
                      <td style="padding:12px 20px;">
                        <p style="margin:0;font-size:12px;font-weight:700;color:#111827;">${idx + 1}. ${prop.title}</p>
                        ${prop.address ? `<p style="margin:2px 0 6px;font-size:11px;color:#9ca3af;">${prop.address}</p>` : ''}
                        <p style="margin:0 0 8px;">
                          ${prop.issues.map(issue => `<span style="display:inline-block;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;color:#aa0000;margin:0 4px 4px 0;">${issue}</span>`).join("")}
                        </p>
                        <a href="${prop.editUrl}" style="font-size:11px;color:#aa0000;font-weight:700;text-decoration:none;">Editar en Tokko &#8594;</a>
                      </td>
                    </tr>
                  </table>`).join("")}
                </td>
              </tr>
            </table>
          </td>
        </tr>` : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>A mitad de semana — InmoCoach</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Barra roja superior -->
        <tr>
          <td style="background:${RED};height:5px;border-radius:12px 12px 0 0;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- Header -->
        <tr>
          <td style="background:#ffffff;padding:28px 32px 20px;border-bottom:1px solid #f3f4f6;">
            <p style="margin:0;font-family:Georgia,serif;font-size:26px;font-weight:900;color:#111827;line-height:1;">
              Inmo<span style="color:${RED};">Coach</span>
            </p>
            <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;font-weight:500;letter-spacing:0.5px;">
              Alerta de mitad de semana · Lunes–Miércoles
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
              Tu actividad comercial a mitad de semana.
            </p>
          </td>
        </tr>

        <!-- KPIs -->
        <tr>
          <td style="background:#ffffff;padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${kpi(greenCount, "Eventos verdes")}
                ${kpi(minGreens, "Meta Lun–Mié")}
                ${kpi(weeklyGoal, "Meta semanal")}
                ${kpi(missing > 0 ? missing : "✓", missing > 0 ? "Faltan" : "Objetivo")}
              </tr>
            </table>
          </td>
        </tr>

        <!-- Barra de progreso -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:16px 20px;">
              <tr>
                <td>
                  <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6b7280;">
                    Progreso Lun–Mié: ${greenCount} de ${minGreens} eventos verdes
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:#e5e7eb;border-radius:999px;height:10px;overflow:hidden;">
                        <div style="width:${pct}%;height:10px;background:${barColor};border-radius:999px;"></div>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:6px 0 0;font-size:11px;font-weight:700;color:${barColor};">${pct}% · Quedan jue y vie</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Consejo del coach (generado por IA) -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="border:1px solid #fecaca;border-radius:14px;overflow:hidden;">
              <tr>
                <td style="background:#fff5f5;padding:12px 20px;border-bottom:1px solid #fecaca;">
                  <p style="margin:0;font-size:11px;font-weight:700;color:${RED};text-transform:uppercase;letter-spacing:0.08em;">
                    📊 InmoCoach — Análisis de mitad de semana
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px;">
                  ${adviceParts.map(p => `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#374151;">${p.trim()}</p>`).join("")}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${tokkoSection}

        <!-- CTA -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 32px;text-align:center;">
            <a href="https://inmocoach.com.ar"
              style="display:inline-block;background:${RED};color:white;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
              Ver mi actividad →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
            <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
              Este mail es automático — no hace falta que respondas. · <a href="https://inmocoach.com.ar" style="color:#9ca3af;">inmocoach.com.ar</a>
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercel = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = req.headers["x-cron-secret"] === process.env.CRON_SECRET;
  if (!isVercel && !isManual) return res.status(401).json({ error: "No autorizado" });

  const cfg = await getAppConfig();
  const minGreens = parseInt(cfg["midweek_min_greens"] ?? "5");
  const weeklyGoal = parseInt(cfg["weekly_goal"] ?? "15");
  const prompt = cfg["midweek_prompt"] ?? DEFAULT_MIDWEEK_PROMPT;

  // Calcular lunes de esta semana en AR (UTC-3)
  const now = new Date();
  const arNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const todayAR = arNow.toISOString().slice(0, 10);
  const dayOfWeek = arNow.getDay();
  const monday = new Date(arNow);
  monday.setDate(arNow.getDate() - ((dayOfWeek + 6) % 7));
  const mondayStr = monday.toISOString().slice(0, 10);

  // Obtener usuarios activos — solo trial vigente o plan pago
  const { data: users } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, plan, team_id, created_at")
    .eq("status", "active")
    .not("google_access_token", "is", null);

  if (!users?.length) return res.status(200).json({ ok: true, sent: 0 });

  const { FREEMIUM_DAYS } = await import("../../../lib/brand");
  const nowMs = Date.now();
  // Excluir free expirado (trial vencido) — solo enviar a: free vigente, individual, teams
  const validUsers = users.filter(u => {
    if (u.plan !== "free") return true;
    const created = new Date(u.created_at || 0).getTime();
    const diffDays = (nowMs - created) / (1000 * 60 * 60 * 24);
    return diffDays <= FREEMIUM_DAYS;
  });

  const { targetEmail } = req.body || {};
  const filteredUsers = targetEmail ? validUsers.filter(u => u.email === targetEmail) : validUsers;

  // Filtrar los que no llegaron al mínimo lun–mié
  const eligible: {
    email: string; name: string; greenCount: number;
    tokkoTotal?: number; tokkoNeedAction?: number;
    tokkoTop3?: { title: string; address: string; issues: string[]; editUrl: string }[];
  }[] = [];
  for (const user of filteredUsers) {
    const { count } = await supabaseAdmin
      .from("calendar_events")
      .select("*", { count: "exact", head: true })
      .eq("user_email", user.email)
      .eq("is_productive", true)
      .gte("start_at", `${mondayStr}T03:00:00Z`)
      .lte("start_at", `${todayAR}T23:59:59Z`);

    if ((count ?? 0) < minGreens) {
      // Fetch Tokko data for this user
      let tokkoTotal: number | undefined;
      let tokkoNeedAction: number | undefined;
      let tokkoTop3: { title: string; address: string; issues: string[]; editUrl: string }[] | undefined;
      try {
        const tokkoStats = await getAgentTokkoStats(user.email);
        if (tokkoStats) {
          tokkoTotal = tokkoStats.total;
          tokkoNeedAction = tokkoStats.incomplete + tokkoStats.stale;
          // Get top 3 most important to fix — fetch raw props for detail
          const { data: teamSub } = await supabaseAdmin.from("subscriptions").select("team_id").eq("email", user.email).single();
          if (teamSub?.team_id) {
            const { data: team } = await supabaseAdmin.from("teams").select("tokko_api_key").eq("id", teamSub.team_id).single();
            if (team?.tokko_api_key) {
              const { data: tokkoAgent } = await supabaseAdmin.from("tokko_agents").select("tokko_id").eq("team_id", teamSub.team_id).eq("email", user.email).maybeSingle();
              const r = await fetch(`https://www.tokkobroker.com/api/v1/property/?key=${team.tokko_api_key}&format=json&lang=es_ar&limit=200`);
              if (r.ok) {
                const d = await r.json();
                const now2 = Date.now();
                const allProps: any[] = d.objects || [];
                const agentProps = tokkoAgent?.tokko_id
                  ? allProps.filter((p: any) => p.producer?.id === tokkoAgent.tokko_id && (p.status === 2 || p.status === "2"))
                  : allProps.filter((p: any) => p.status === 2 || p.status === "2");

                // Score: more issues = higher priority
                const scored = agentProps.map((p: any) => {
                  const issues: string[] = [];
                  const photos = (p.photos || []).filter((ph: any) => !ph.is_blueprint);
                  if (photos.length < 15) issues.push(`${photos.length}/15 fotos`);
                  if (!(p.photos || []).some((ph: any) => ph.is_blueprint)) issues.push("sin plano");
                  if (!p.videos?.length && !p.tags?.some((t: any) => t.name?.toLowerCase().includes("360"))) issues.push("sin video/tour");
                  const dateStr = p.deleted_at || p.created_at;
                  const ageDays = dateStr ? Math.floor((now2 - new Date(dateStr).getTime()) / 86400000) : null;
                  if (ageDays !== null && ageDays > 90) issues.push(`+${ageDays} días sin editar`);
                  return { p, issues };
                }).filter(x => x.issues.length > 0).sort((a, b) => b.issues.length - a.issues.length);

                tokkoTop3 = scored.slice(0, 3).map(({ p, issues }) => ({
                  title: p.publication_title || p.type?.name || "Propiedad",
                  address: p.fake_address || p.address || "",
                  issues,
                  editUrl: `https://www.tokkobroker.com/property/${p.id}/`,
                }));
              }
            }
          }
        }
      } catch { /* silencioso */ }

      eligible.push({
        email: user.email,
        name: user.name || user.email.split("@")[0],
        greenCount: count ?? 0,
        tokkoTotal, tokkoNeedAction, tokkoTop3,
      });
    }
  }

  if (!eligible.length) return res.status(200).json({ ok: true, sent: 0, reason: "Todos llegaron al mínimo" });

  // Generar UN solo texto con IA (mismo para todos)
  const advice = await generateMidweekAdvice(prompt);

  // Enviar con pausa para respetar rate limit de Resend
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < eligible.length; i++) {
    const user = eligible[i];
    const firstName = (user.name || "").split(" ")[0] || "Agente";
    try {
      const { error } = await resend.emails.send({
        from: "InmoCoach <coach@inmocoach.com.ar>",
        to: user.email,
        subject: `A mitad de semana · ${user.greenCount} de ${minGreens} eventos verdes`,
        html: buildHtml({ firstName, greenCount: user.greenCount, minGreens, weeklyGoal, advice, tokkoTotal: user.tokkoTotal, tokkoNeedAction: user.tokkoNeedAction, tokkoTop3: user.tokkoTop3 }),
      });
      if (error) { failed++; console.error(`❌ ${user.email}:`, error); }
      else { sent++; console.log(`✅ ${user.email} (${user.greenCount} verdes)`); }
    } catch (e: any) {
      failed++;
      console.error(`❌ ${user.email}:`, e?.message);
    }
    if (i < eligible.length - 1) await new Promise(r => setTimeout(r, 600));
  }

  console.log(`📊 Midweek: ${sent} enviados, ${failed} errores, ${filteredUsers.length - eligible.length} ya llegaron al mínimo`);
  return res.status(200).json({ ok: true, sent, failed, skipped: filteredUsers.length - eligible.length });
}
