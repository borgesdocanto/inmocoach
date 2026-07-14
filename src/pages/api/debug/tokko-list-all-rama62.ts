import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { getReservedPropertiesBranch } from "../../../lib/trelloSync";
import { getSession } from "next-auth/react";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let userEmail: string | undefined = req.query.email as string;
    
    if (!userEmail) {
      try {
        const session = await getSession({ req });
        userEmail = session?.user?.email || undefined;
      } catch (e) {
        userEmail = (req.headers["x-user-email"] as string) || undefined;
      }
    }

    if (!userEmail) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id, team_role")
      .eq("email", userEmail)
      .single();

    if (!sub) {
      return res.status(403).json({ error: "User not found" });
    }

    const isGalasTeam = sub.team_id === "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";
    const isAuthorized = (sub.team_role === "owner" || sub.team_role === "team_leader") && isGalasTeam;

    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", sub.team_id)
      .single();

    if (!team?.tokko_api_key) {
      return res.status(400).json({ error: "No Tokko API key" });
    }

    // Traer propiedades de rama 62
    const properties = await getReservedPropertiesBranch(team.tokko_api_key, 62);

    // Listar TODAS
    const allProps = properties.map((p: any) => ({
      reference_code: p.reference_code,
      address: p.address,
      status: p.status,
      branch_id: p.branch?.id,
    }));

    res.status(200).json({
      success: true,
      total_count: properties.length,
      all_properties: allProps,
      // Verificar si EHO8463246 y EPH8463243 están
      contains_soler: properties.some((p: any) => p.reference_code === "EHO8463246"),
      contains_mallorca: properties.some((p: any) => p.reference_code === "EPH8463243"),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
