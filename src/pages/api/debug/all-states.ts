import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const apiKey = "44b438c60bbde9a6e02e62afda4ef2e86f15aa1d";

    const states = [
      { flag: "only_to_be_cotized", label: "Status 1: A Tasar" },
      { flag: "only_reserved", label: "Status 3: Reservado" },
      { flag: "only_not_available", label: "Status 4: No Disponible" },
    ];

    const results: any = {};

    for (const state of states) {
      const searchData = {
        filters: [],
        only_available: false,
        [state.flag]: "checked",
        with_tags: [],
        without_tags: [],
        with_custom_tags: [],
        with_or_custom_tags: [],
        without_custom_tags: [],
        operation_types: [1, 2, 3],
        property_types: [1, 2, 3, 4, 5, 6, 7],
        price_from: 0,
        price_to: 9999999999,
        currency: "USD",
      };

      const url = new URL("https://www.tokkobroker.com/api/v1/property/search/");
      url.searchParams.append("key", apiKey);
      url.searchParams.append("format", "json");
      url.searchParams.append("lang", "es_ar");
      url.searchParams.append("data", JSON.stringify(searchData));
      url.searchParams.append("limit", "10");

      const response = await fetch(url.toString());
      const data = await response.json();
      const count = (data.objects || []).length;

      results[state.label] = {
        count: count,
        total_in_api: data.meta?.total_count || 0,
        first_sample: (data.objects || []).slice(0, 2).map((p: any) => ({
          address: p.address,
          status: p.status,
          ref: p.reference_code,
        })),
      };
    }

    res.status(200).json({
      success: true,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
