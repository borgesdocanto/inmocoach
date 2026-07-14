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

    // Traer propiedades de Tokko
    const properties = await getReservedPropertiesBranch(team.tokko_api_key, 62);

    // Buscar ambas propiedades
    const soler = properties.find((p: any) => p.reference_code === "EHO8463246");
    const mallorca = properties.find((p: any) => p.reference_code === "EPH8463243");

    res.status(200).json({
      success: true,
      total_properties: properties.length,
      soler_1175: soler ? {
        found: true,
        reference_code: soler.reference_code,
        address: soler.address,
        status: soler.status,
        is_reserved: soler.status === 3,
        branch_id: soler.branch?.id,
        branch_name: soler.branch?.name,
      } : { found: false },
      mallorca_1431: mallorca ? {
        found: true,
        reference_code: mallorca.reference_code,
        address: mallorca.address,
        status: mallorca.status,
        is_reserved: mallorca.status === 3,
        branch_id: mallorca.branch?.id,
        branch_name: mallorca.branch?.name,
      } : { found: false },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
