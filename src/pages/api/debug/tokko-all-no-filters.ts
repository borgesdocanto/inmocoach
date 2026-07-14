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

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", sub.team_id)
      .single();

    if (!team?.tokko_api_key) {
      return res.status(400).json({ error: "No Tokko API key" });
    }

    // Búsqueda TOTALMENTE SIN FILTROS (solo lo mínimo)
    const searchData = {
      filters: [],
      only_available: "undefined",
      only_reserved: "undefined",
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
      network: [],  // SIN NETWORK
      exclude_my_properties: false,
      price_from: "0",
      price_to: "9999999999",
      operation_types: [],
      property_types: [],
      currency: "USD",
      bounding_box: [],
    };

    const url = new URL("https://www.tokkobroker.com/api/v1/property/search/");
    url.searchParams.append("key", team.tokko_api_key);
    url.searchParams.append("format", "json");
    url.searchParams.append("lang", "es_ar");
    url.searchParams.append("data", JSON.stringify(searchData));
    url.searchParams.append("limit", "500");

    const response = await fetch(url.toString());
    const data = await response.json();
    const allProperties = data.objects || [];

    // Buscar parecidas a "Soler" o "Mallorca" o "8463"
    const solerLike = allProperties.filter((p: any) => 
      p.address?.toLowerCase().includes("soler") || 
      p.reference_code?.includes("8463")
    );
    
    const mallorLike = allProperties.filter((p: any) => 
      p.address?.toLowerCase().includes("mallorca") || 
      p.reference_code?.includes("8463")
    );

    res.status(200).json({
      success: true,
      total_properties_no_filters: allProperties.length,
      search_results_for_soler: solerLike.map((p: any) => ({
        reference_code: p.reference_code,
        address: p.address,
        status: p.status,
        network: p.network?.id,
      })),
      search_results_for_mallorca: mallorLike.map((p: any) => ({
        reference_code: p.reference_code,
        address: p.address,
        status: p.status,
        network: p.network?.id,
      })),
      hint: "Si no aparecen arriba, busca manualmente en la lista completa de abajo",
      all_ref_codes: allProperties.slice(0, 50).map((p: any) => ({
        ref: p.reference_code,
        addr: p.address.substring(0, 40),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
