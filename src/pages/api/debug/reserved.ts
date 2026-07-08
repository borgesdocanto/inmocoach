import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const apiKey = "44b438c60bbde9a6e02e62afda4ef2e86f15aa1d";
    const searchAddress = req.query.address as string || "";

    console.log("🔄 Trayendo propiedades RESERVADAS (status=3)...");

    // Solo usar los flags especiales, sin filtro explícito de status
    const searchData = {
      filters: [],
      only_available: false,
      only_reserved: "checked", // Esto trae status=3
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
    url.searchParams.append("limit", "500");

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `${response.status}: ${text}` });
    }

    const data = await response.json();
    let reserved = data.objects || [];

    console.log(`✅ Encontradas ${reserved.length} propiedades con status=3 (reservadas)`);

    if (searchAddress) {
      reserved = reserved.filter((p: any) => 
        p.address?.toLowerCase().includes(searchAddress.toLowerCase())
      );
    }

    res.status(200).json({
      success: true,
      count: reserved.length,
      total_in_api: data.meta?.total_count,
      reserved_properties: reserved.slice(0, 50).map((p: any) => ({
        id: p.id,
        address: p.address,
        reference_code: p.reference_code,
        status: p.status,
        producer_name: p.producer?.name,
        producer_email: p.producer?.email,
        branch: p.branch?.name,
        photos_count: (p.photos || []).length,
        operation_type: p.type?.name,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
