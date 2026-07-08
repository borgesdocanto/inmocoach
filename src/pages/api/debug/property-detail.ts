import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const apiKey = "44b438c60bbde9a6e02e62afda4ef2e86f15aa1d";
    const propId = req.query.id as string;
    const propRef = req.query.ref as string;

    if (!propId && !propRef) {
      return res.status(400).json({ error: "Pasar ?id=123 o ?ref=EHO374273" });
    }

    console.log(`🔍 Buscando propiedad: id=${propId}, ref=${propRef}`);

    // Usar search para traer la propiedad específica
    const searchData = {
      filters: propId 
        ? [["id", "", propId]]
        : [["reference_code", "", propRef]],
      only_available: false,
      with_tags: [],
      without_tags: [],
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
    url.searchParams.append("limit", "1");

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    const property = (data.objects || [])[0];

    if (!property) {
      return res.status(404).json({ error: "Propiedad no encontrada" });
    }

    console.log(`✅ Encontrada: ${property.address}`);

    res.status(200).json({
      success: true,
      property: property, // JSON COMPLETO
      summary: {
        id: property.id,
        address: property.address,
        reference_code: property.reference_code,
        status: property.status,
        is_published: property.is_published,
        is_reserved: property.is_reserved, // Buscar este campo
        operation_status: property.operation_status, // O este
        _all_fields: Object.keys(property).sort(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
