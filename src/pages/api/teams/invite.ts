import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { getOrCreateTeam, inviteAgent, getPendingInvitations, getTeamMembers, getTeamByOwner, getDisplayName } from "../../../lib/teams";
import { supabaseAdmin } from "../../../lib/supabase";
import { Resend } from "resend";
import { EMAIL_FROM, emailWrapper } from "../../../lib/email";

const resend = new Resend(process.env.RESEND_API_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan, team_role, team_id")
    .eq("email", session.user.email)
    .single();

  // Freemium también puede usar teams — solo owner y team_leader
  const canManage = sub && ["owner", "team_leader"].includes(sub.team_role);
  if (!canManage) {
    return res.status(403).json({ error: "Solo owners y team leaders pueden gestionar el equipo" });
  }

  if (req.method === "GET") {
    const [{ members, requesterRole }, pending] = await Promise.all([
      getTeamMembers(session.user.email),
      getPendingInvitations(session.user.email),
    ]);
    return res.status(200).json({ members, pending, requesterRole, brokerPlan: sub.plan });
  }

  if (req.method === "POST") {
    const { email } = req.body;
    if (!email || !email.includes("@")) return res.status(400).json({ error: "Email inválido" });

    const brokerName = session.user.name || session.user.email!;
    const team = await getOrCreateTeam(session.user.email, `Equipo de ${brokerName}`);

    // Verificar bloqueo de 60 días por remoción previa
    const { data: removal } = await supabaseAdmin
      .from("team_removals")
      .select("blocked_until, removed_at")
      .eq("team_id", team.id)
      .eq("removed_email", email)
      .gte("blocked_until", new Date().toISOString())
      .maybeSingle();

    if (removal) {
      const blockedUntil = new Date(removal.blocked_until);
      const daysLeft = Math.ceil((blockedUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return res.status(400).json({
        error: `Este agente fue removido recientemente. Podés volver a invitarlo en ${daysLeft} días (${blockedUntil.toLocaleDateString("es-AR")}).`,
        blockedUntil: removal.blocked_until,
      });
    }
    const teamData = await getTeamByOwner(session.user.email);
    const displayName = getDisplayName(team, brokerName);
    const agencyName = teamData?.agencyName || null;

    const { members } = await getTeamMembers(session.user.email);
    if (members.filter(m => m.teamRole === "member" || m.teamRole === "team_leader").length >= team.maxAgents) {
      return res.status(400).json({ error: `Límite de ${team.maxAgents} agentes alcanzado` });
    }

    const { token } = await inviteAgent(team.id, email, session.user.email);
    const inviteUrl = `${process.env.NEXTAUTH_URL}/equipo/aceptar?token=${token}`;

    try {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: email,
        subject: `${brokerName} te invitó a su equipo en InmoCoach`,
        html: emailWrapper(`
          <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:900;color:#111827;margin:0 0 12px;">Fuiste invitado al equipo</h2>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
            <strong>${brokerName}</strong> te invitó a unirte a su equipo en InmoCoach.<br/>
            Al aceptar, tu acceso queda cubierto por el plan del equipo — no pagás nada extra.
          </p>
          <a href="${inviteUrl}" style="display:inline-block;background:#aa0000;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
            Aceptar invitación →
          </a>
          <p style="color:#9ca3af;font-size:12px;margin:20px 0 0;">Si no esperabas esta invitación, podés ignorar este mail.</p>
        `),
      });
    } catch (e) {
      console.error("Error enviando invitación:", e);
    }

    return res.status(200).json({ ok: true, token, inviteUrl });
  }

  return res.status(405).end();
}
