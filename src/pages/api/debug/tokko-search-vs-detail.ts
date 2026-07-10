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

    const { refCode } = req.query;
    if (!refCode || typeof refCode !== "string") {
      return res.status(400).json({ error: "Missing refCode" });
    }

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", sub.team_id)
      .single();

    if (!team?.tokko_api_key) {
      return res.status(400).json({ error: "No Tokko API key" });
    }

    // 1. BÚSQUEDA (como hace sync)
    const searchData = {
      filters: [["reference_code", "", refCode]],
      only_reserved: "checked",
      network: [660],
      // ... otros filtros
    };

    const searchUrl = new URL("https://www.tokkobroker.com/api/v1/property/search/");
    searchUrl.searchParams.append("key", team.tokko_api_key);
    searchUrl.searchParams.append("format", "json");
    searchUrl.searchParams.append("lang", "es_ar");
    searchUrl.searchParams.append("data", JSON.stringify(searchData));
    searchUrl.searchParams.append("limit", "500");

    const searchResp = await fetch(searchUrl.toString());
    const searchData2 = await searchResp.json();
    const searchResult = searchData2.objects?.[0];

    // 2. BUSCAR POR ID (si tenemos el ID)
    let detailResult = null;
    if (searchResult?.id) {
      const detailUrl = new URL(
        `https://www.tokkobroker.com/api/v1/property/${searchResult.id}/`
      );
      detailUrl.searchParams.append("key", team.tokko_api_key);

      const detailResp = await fetch(detailUrl.toString());
      const detailData = await detailResp.json();
      detailResult = detailData.property || detailData;
    }

    res.status(200).json({
      message: "Comparación: Search vs Detail endpoint",
      refCode,
      search_has_internal_data: !!searchResult?.internal_data,
      search_keys: searchResult ? Object.keys(searchResult).slice(0, 20) : [],
      detail_has_internal_data: !!detailResult?.internal_data,
      detail_keys: detailResult ? Object.keys(detailResult).slice(0, 20) : [],
      search_producer: searchResult?.producer,
      detail_producer: detailResult?.producer,
      search_internal_data: searchResult?.internal_data ? Object.keys(searchResult.internal_data) : "N/A",
      detail_internal_data: detailResult?.internal_data ? Object.keys(detailResult.internal_data) : "N/A",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
