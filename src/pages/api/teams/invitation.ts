import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { Resend } from "resend";
import { EMAIL_FROM, emailWrapper } from "../../../lib/email";

const resend = new Resend(process.env.RESEND_API_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const { action, token } = req.body as { action: "resend" | "cancel"; token: string };
  if (!action || !token) return res.status(400).json({ error: "Datos inválidos" });

  // Verificar que la invitación pertenece a un equipo del que es owner
  const { data: inv } = await supabaseAdmin
    .from("team_invitations")
    .select("*, teams(owner_email)")
    .eq("token", token)
    .eq("status", "pending")
    .single();

  if (!inv) return res.status(404).json({ error: "Invitación no encontrada" });
  if (inv.teams.owner_email !== session.user.email) return res.status(403).json({ error: "No autorizado" });

  if (action === "cancel") {
    await supabaseAdmin
      .from("team_invitations")
      .update({ status: "cancelled" })
      .eq("token", token);
    return res.status(200).json({ ok: true });
  }

  if (action === "resend") {
    const brokerName = session.user.name || session.user.email;
    const inviteUrl = `${process.env.NEXTAUTH_URL}/equipo/aceptar?token=${token}`;

    try {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: inv.email,
        subject: `Recordatorio: ${brokerName} te invitó a su equipo en InstaCoach`,
        html: emailWrapper(`
          <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:900;color:#111827;margin:0 0 12px;">Tu invitación sigue esperando</h2>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 8px;">
            <strong>${brokerName}</strong> te invitó a unirte a su equipo en InstaCoach y todavía no aceptaste.
          </p>
          <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 24px;">
            Al aceptar, tu acceso queda cubierto por el plan del equipo — no pagás nada extra.
          </p>
          <a href="${inviteUrl}" style="display:inline-block;background:#aa0000;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
            Aceptar invitación →
          </a>
          <p style="color:#9ca3af;font-size:12px;margin:20px 0 0;">Si no esperabas esta invitación, podés ignorar este mail.</p>
        `),
      });
    } catch (e) {
      console.error("Error reenviando invitación:", e);
      return res.status(500).json({ error: "No se pudo reenviar el mail" });
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Acción inválida" });
}
