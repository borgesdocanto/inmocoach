import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const refCode = (req.query.ref as string) || "EPH7303883"; // Propiedad de ejemplo

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93")
      .single();

    if (!team?.tokko_api_key) {
      return res.status(400).json({ error: "No API key" });
    }

    const key = team.tokko_api_key;

    // Búsqueda por reference_code
    const searchData = {
      filters: [["reference_code", "", refCode]],
      network: [],
      exclude_my_properties: false,
      price_from: "0",
      price_to: "9999999999",
      operation_types: [],
      property_types: [],
      currency: "USD",
      bounding_box: [],
    };

    const url = new URL("https://www.tokkobroker.com/api/v1/property/search/");
    url.searchParams.append("key", key);
    url.searchParams.append("format", "json");
    url.searchParams.append("lang", "es_ar");
    url.searchParams.append("data", JSON.stringify(searchData));
    url.searchParams.append("limit", "500");

    const resp = await fetch(url.toString());
    const data = await resp.json();
    const property = data.objects?.[0];

    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }

    // Devolver TODA la estructura JSON para inspeccionar
    res.status(200).json({
      reference_code: property.reference_code,
      address: property.address,
      all_keys: Object.keys(property).sort(),
      internal_data_keys: Object.keys(property.internal_data || {}).sort(),
      full_object: property,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
