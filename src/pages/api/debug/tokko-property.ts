import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { getSession } from "next-auth/react";
import { isSuperAdmin } from "../../../lib/adminGuard";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getSession({ req });
    if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { refCode } = req.query;
    if (!refCode || typeof refCode !== "string") {
      return res.status(400).json({ error: "Missing refCode query parameter" });
    }

    // Obtener Tokko API key
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("team_id")
      .eq("email", session.user.email)
      .single();

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", sub?.team_id || "")
      .single();

    if (!team?.tokko_api_key) {
      return res.status(400).json({ error: "No Tokko API key" });
    }

    // Buscar propiedad por reference_code
    const searchData = {
      filters: [["reference_code", "", refCode]],
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

    const searchUrl = new URL(
      "https://www.tokkobroker.com/api/v1/property/search/"
    );
    searchUrl.searchParams.append("key", team.tokko_api_key);
    searchUrl.searchParams.append("lang", "es_ar");
    searchUrl.searchParams.append("format", "json");
    searchUrl.searchParams.append("data", JSON.stringify(searchData));

    const response = await fetch(searchUrl.toString());
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: `Tokko error: ${response.status}` });
    }

    const data = await response.json();
    const property = data.data?.[0];

    if (!property) {
      return res.status(404).json({ error: `Property ${refCode} not found` });
    }

    res.status(200).json({
      refCode: property.reference_code,
      address: property.address,
      producer: property.producer,
      producer_email: property.producer?.email,
      created_by: property.created_by,
      created_by_email: property.created_by?.email,
      status: property.status,
    });
  } catch (error: any) {
    console.error("[tokko-property] Error:", error);
    res.status(500).json({ error: error.message });
  }
}
