import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";
import { FREEMIUM_DAYS } from "../../../lib/brand";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).json({ error: "Forbidden" });

  // GET — listar usuarios con filtros opcionales
  if (req.method === "GET") {
    const { plan, search } = req.query;
    let query = supabaseAdmin
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false });

    if (plan && plan !== "all") query = query.eq("plan", plan);
    if (search) query = query.ilike("email", `%${search}%`);

    const { data } = await query.limit(200);
    const now = new Date();

    const users = (data || []).map(u => {
      const created = new Date(u.created_at);
      const daysSince = Math.floor((now.getTime() - created.getTime()) / 86400000);
      // Respetar trial_ends_at si está seteado
      const trialEnd = u.trial_ends_at ? new Date(u.trial_ends_at) : null;
      const freemiumExpired = u.plan === "free" && (
        trialEnd ? now > trialEnd : daysSince > FREEMIUM_DAYS
      );
      const freemiumDaysLeft = u.plan === "free"
        ? trialEnd
          ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000))
          : Math.max(0, FREEMIUM_DAYS - daysSince)
        : null;
      return {
        email: u.email,
        name: u.name,
        avatar: u.avatar,
        plan: u.plan,
        status: u.status,
        teamId: u.team_id,
        teamRole: u.team_role,
        hasCalendar: !!u.google_access_token,
        createdAt: u.created_at,
        trialEndsAt: u.trial_ends_at || null,
        daysSince,
        freemiumExpired,
        freemiumDaysLeft,
      };
    });

    return res.status(200).json({ users });
  }

  // POST — modificar usuario
  if (req.method === "POST") {
    const { action, email, plan, daysExtension } = req.body;
    if (!email) return res.status(400).json({ error: "Email requerido" });

    if (action === "change_plan") {
      if (!["free", "individual", "teams"].includes(plan)) return res.status(400).json({ error: "Plan inválido" });
      await supabaseAdmin.from("subscriptions").update({ plan, status: "active" }).eq("email", email);
      return res.status(200).json({ ok: true });
    }

    if (action === "extend_trial") {
      const days = parseInt(daysExtension) || 7;
      // Reset created_at to today so they get a fresh `days` day trial from now
      const newCreated = new Date();
      newCreated.setDate(newCreated.getDate() - (7 - days)); // e.g. 7 days from now = today
      // Simpler: just set created_at to now, they get FREEMIUM_DAYS from today
      const freshStart = new Date().toISOString();
      await supabaseAdmin.from("subscriptions")
        .update({ created_at: freshStart, status: "active" })
        .eq("email", email);
      return res.status(200).json({ ok: true, message: `Trial extendido ${days} días desde hoy` });
    }

    if (action === "deactivate") {
      await supabaseAdmin.from("subscriptions").update({ status: "cancelled" }).eq("email", email);
      return res.status(200).json({ ok: true });
    }

    if (action === "reactivate") {
      await supabaseAdmin.from("subscriptions").update({ status: "active" }).eq("email", email);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Acción inválida" });
  }

  return res.status(405).end();
}
