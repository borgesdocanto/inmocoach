import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { isSuperAdmin } from "../../lib/adminGuard";
import { supabaseAdmin } from "../../lib/supabase";
import { serialize, parse } from "cookie";

export const IMPERSONATE_COOKIE = "ic_impersonate";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return res.status(403).json({ error: "Sin acceso" });
  }

  // POST — start impersonation
  if (req.method === "POST") {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email requerido" });

    // Verify user exists
    const { data: user } = await supabaseAdmin
      .from("subscriptions")
      .select("email, name, avatar")
      .eq("email", email)
      .single();

    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    res.setHeader("Set-Cookie", serialize(IMPERSONATE_COOKIE, email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hora
      path: "/",
    }));

    return res.status(200).json({ ok: true, impersonating: email });
  }

  // DELETE — stop impersonation
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", serialize(IMPERSONATE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    }));
    return res.status(200).json({ ok: true });
  }

  // GET — current impersonation status
  if (req.method === "GET") {
    const cookies = parse(req.headers.cookie || "");
    const impersonating = cookies[IMPERSONATE_COOKIE] || null;
    return res.status(200).json({ impersonating });
  }

  return res.status(405).end();
}
