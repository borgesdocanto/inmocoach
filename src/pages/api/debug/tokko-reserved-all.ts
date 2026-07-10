import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { getSession } from "next-auth/react";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Obtener email (query param, sesión o header)
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
      return res.status(401).json({ error: "Unauthorized - provide ?email=your@email.com" });
    }

    // Verificar GALAS owner/team_leader
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
      return res.status(403).json({ error: "Forbidden - Not GALAS owner/team_leader" });
    }

    // Obtener Tokko API key
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", sub.team_id)
      .single();

    if (!team?.tokko_api_key) {
      return res.status(400).json({ error: "No Tokko API key" });
    }

    const branchId = req.query.branchId ? parseInt(req.query.branchId as string) : 62;

    // VERSIÓN SIN FILTRO DE BRANCH para ver si funciona
    const searchData = {
      filters: [], // ← SIN el filtro de branch_id
      only_available: "undefined",
      only_reserved: "checked",
      only_to_be_cotized: "undefined",
      only_not_available: "undefined",
      with_tags: [],
      without_tags: [],
      with_custom_tags: [],
      with_or_custom_tags: [],
      without_custom_tags: [],
      listing_edition_review: "undefined",
      division_filters: [],
      state_filters: [],
      current_localization_id: "0",
      current_localization_type: "",
      network: [660],
      exclude_my_properties: false,
      price_from: "0",
      price_to: "9999999999",
      operation_types: [],
      property_types: [],
      currency: "USD",
    };

    console.log("🔍 DEBUG Tokko search (SIN branch filter):");
    console.log("Payload:", JSON.stringify(searchData, null, 2));

    const searchUrl = new URL(
      "https://www.tokkobroker.com/api/v1/property/search/"
    );
    searchUrl.searchParams.append("key", team.tokko_api_key);
    searchUrl.searchParams.append("lang", "es_ar");
    searchUrl.searchParams.append("format", "json");
    searchUrl.searchParams.append("data", JSON.stringify(searchData));

    console.log("URL:", searchUrl.toString().substring(0, 150) + "...");

    const response = await fetch(searchUrl.toString());
    const data = await response.json();

    console.log("Response status:", response.status);
    console.log("Response data:", JSON.stringify(data).substring(0, 500));

    res.status(200).json({
      ok: response.ok,
      status: response.status,
      branchId,
      message: "Sin filtro de branch_id",
      result: {
        total: data.count || 0,
        found: data.data?.length || 0,
        properties: data.data?.map((p: any) => ({
          refCode: p.reference_code,
          address: p.address,
          status: p.status,
          branch_id: p.branch_id,
          branch_name: p.branch?.name,
          producer: p.producer?.email,
        })) || [],
      },
    });
  } catch (error: any) {
    console.error("[tokko-reserved-all] Error:", error);
    res.status(500).json({ error: error.message });
  }
}
