import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";
import { getEffectiveEmail } from "../../lib/impersonation";
import { MAIL_DEFINITIONS } from "../../lib/autoMailTemplates";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const effectiveEmail = getEffectiveEmail(req, session);

  const { data: requester } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id, team_role")
    .eq("email", effectiveEmail)
    .single();

  if (!requester?.team_id) return res.status(403).json({ error: "Sin equipo" });
  const canManage = requester.team_role === "owner" || requester.team_role === "team_leader";

  // GET — devolver todos los templates con defaults mezclados
  if (req.method === "GET") {
    const { data: saved } = await supabaseAdmin
      .from("loyalty_email_templates")
      .select("mail_key, subject, body, enabled")
      .eq("team_id", requester.team_id);

    const savedMap: Record<string, { subject: string; body: string; enabled: boolean }> = {};
    for (const row of saved || []) {
      savedMap[row.mail_key] = { subject: row.subject, body: row.body, enabled: row.enabled };
    }

    const templates = MAIL_DEFINITIONS.map(def => ({
      key: def.key,
      label: def.label,
      emoji: def.emoji,
      description: def.description,
      when: def.when,
      category: def.category,
      subject: savedMap[def.key]?.subject ?? def.defaultSubject,
      body: savedMap[def.key]?.body ?? def.defaultBody,
      enabled: savedMap[def.key]?.enabled ?? true,
      isCustom: !!savedMap[def.key],
    }));

    return res.json({ templates });
  }

  // PUT — guardar un template (subject, body, enabled)
  if (req.method === "PUT") {
    if (!canManage) return res.status(403).json({ error: "Sin permisos" });

    const { key, subject, body, enabled, reset } = req.body;
    if (!key) return res.status(400).json({ error: "Falta key" });

    const validKey = MAIL_DEFINITIONS.find(d => d.key === key);
    if (!validKey) return res.status(400).json({ error: "Key inválida" });

    // Si reset=true, eliminar la fila custom para volver al default
    if (reset) {
      await supabaseAdmin
        .from("loyalty_email_templates")
        .delete()
        .eq("team_id", requester.team_id)
        .eq("mail_key", key);
      return res.json({ ok: true });
    }

    const { error } = await supabaseAdmin
      .from("loyalty_email_templates")
      .upsert({
        team_id: requester.team_id,
        mail_key: key,
        subject: subject ?? validKey.defaultSubject,
        body: body ?? validKey.defaultBody,
        enabled: enabled ?? true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "team_id,mail_key" });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
