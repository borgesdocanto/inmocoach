import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93")
      .single();

    if (!team?.tokko_api_key) {
      return res.status(400).json({ error: "No API key" });
    }

    const key = team.tokko_api_key;

    // Búsqueda 1: Soler
    const searchSoler = {
      filters: [["address", "like", "Soler 1175"]],
      network: [],
      exclude_my_properties: false,
      price_from: "0",
      price_to: "9999999999",
      operation_types: [],
      property_types: [],
      currency: "USD",
      bounding_box: [],
    };

    const url1 = new URL("https://www.tokkobroker.com/api/v1/property/search/");
    url1.searchParams.append("key", key);
    url1.searchParams.append("format", "json");
    url1.searchParams.append("lang", "es_ar");
    url1.searchParams.append("data", JSON.stringify(searchSoler));
    url1.searchParams.append("limit", "500");

    const resp1 = await fetch(url1.toString());
    const data1 = await resp1.json();

    // Búsqueda 2: Mallorca
    const searchMallorca = {
      filters: [["address", "like", "Mallorca 1431"]],
      network: [],
      exclude_my_properties: false,
      price_from: "0",
      price_to: "9999999999",
      operation_types: [],
      property_types: [],
      currency: "USD",
      bounding_box: [],
    };

    const url2 = new URL("https://www.tokkobroker.com/api/v1/property/search/");
    url2.searchParams.append("key", key);
    url2.searchParams.append("format", "json");
    url2.searchParams.append("lang", "es_ar");
    url2.searchParams.append("data", JSON.stringify(searchMallorca));
    url2.searchParams.append("limit", "500");

    const resp2 = await fetch(url2.toString());
    const data2 = await resp2.json();

    res.status(200).json({
      soler: data1.objects?.map((p: any) => ({
        reference_code: p.reference_code,
        address: p.address,
        status: p.status,
        branch: p.branch?.name,
        branch_id: p.branch?.id,
      })) || [],
      mallorca: data2.objects?.map((p: any) => ({
        reference_code: p.reference_code,
        address: p.address,
        status: p.status,
        branch: p.branch?.name,
        branch_id: p.branch?.id,
      })) || [],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
