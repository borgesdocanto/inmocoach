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

    // Llamar getReservedPropertiesBranch (el función que usamos)
    const properties = await getReservedPropertiesBranch(team.tokko_api_key, 62);

    // Buscar EPH7303883
    const eph = properties.find((p: any) => p.reference_code === "EPH7303883");

    res.status(200).json({
      success: true,
      total_properties: properties.length,
      found_eph7303883: !!eph,
      eph_data: eph ? {
        reference_code: eph.reference_code,
        address: eph.address,
        branch_id: eph.branch?.id,
        branch_name: eph.branch?.name,
        status: eph.status,
        producer: eph.producer?.name,
        photos_count: eph.photos?.length || 0,
        has_photos: !!eph.photos?.length,
      } : null,
      first_5_properties: properties.slice(0, 5).map((p: any) => ({
        reference_code: p.reference_code,
        address: p.address,
        branch_id: p.branch?.id,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}
