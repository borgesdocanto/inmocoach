import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { getSession } from "next-auth/react";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let userEmail = null;
    try {
      const session = await getSession({ req });
      userEmail = session?.user?.email;
    } catch (e) {
      console.log("⚠️ getSession falló");
    }

    if (!userEmail) {
      userEmail = req.headers["x-user-email"] as string;
    }

    if (!userEmail) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Obtener team_id
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id, team_role")
      .eq("email", userEmail)
      .single();

    if (!sub) {
      return res.status(403).json({ error: "User not found" });
    }

    const isGalasTeam = sub.team_id === "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";
    const isAuthorized =
      (sub.team_role === "owner" || sub.team_role === "team_leader") &&
      isGalasTeam;

    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.method === "GET") {
      // Obtener configuración actual
      const { data, error } = await supabaseAdmin
        .from("trello_default_members")
        .select("emails")
        .eq("team_id", sub.team_id)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows
        return res.status(400).json({ error: error.message });
      }

      const emails = data?.emails || [
        "leandro@galas.com.ar",
        "luciana@galas.com.ar",
      ];

      return res.status(200).json({
        success: true,
        emails,
      });
    }

    if (req.method === "POST") {
      // Guardar configuración
      const { emails } = req.body;

      if (!Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ error: "emails must be a non-empty array" });
      }

      // Validar que sean emails
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of emails) {
        if (!emailRegex.test(email)) {
          return res
            .status(400)
            .json({ error: `Invalid email: ${email}` });
        }
      }

      // Upsert
      const { data, error } = await supabaseAdmin
        .from("trello_default_members")
        .upsert(
          {
            team_id: sub.team_id,
            emails,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "team_id",
          }
        )
        .select();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({
        success: true,
        emails: data?.[0]?.emails,
      });
    }
  } catch (error: any) {
    console.error("[trello-config-members] Error:", error);
    res.status(500).json({ error: error.message });
  }
}
