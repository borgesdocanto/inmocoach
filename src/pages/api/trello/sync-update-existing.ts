import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";
import { getSession } from "next-auth/react";

export const config = {
  maxDuration: 300,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Obtener email
    let userEmail = null;
    try {
      const session = await getSession({ req });
      userEmail = session?.user?.email;
    } catch (e) {
      console.log("⚠️ getSession falló");
    }

    if (!userEmail) {
      userEmail = req.headers["x-user-email"] as string;
    }

    if (!userEmail) {
      return res.status(401).json({ error: "Unauthorized - No email provided" });
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
    const isAuthorized =
      (sub.team_role === "owner" || sub.team_role === "team_leader") &&
      isGalasTeam;

    if (!isAuthorized) {
      return res
        .status(403)
        .json({ error: "Forbidden - Not GALAS owner/team_leader" });
    }

    // Credenciales Trello y Tokko
    const trelloKey = process.env.TRELLO_API_KEY;
    const trelloToken = process.env.TRELLO_TOKEN;
    const trelloBoardId = process.env.TRELLO_BOARD_ID;
    const teamId = "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";

    if (!trelloKey || !trelloToken || !trelloBoardId) {
      return res
        .status(400)
        .json({ error: "Trello credentials not configured" });
    }

    // Obtener Tokko API key
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", teamId)
      .single();

    if (!team?.tokko_api_key) {
      return res
        .status(400)
        .json({ error: "Tokko API key not configured" });
    }

    console.log("🚀 Iniciando sincronización de descripción y checklists...");

    // 1. Obtener todas las tarjetas
    const cardsUrl = new URL(`https://api.trello.com/1/boards/${trelloBoardId}/cards`);
    cardsUrl.searchParams.append("key", trelloKey);
    cardsUrl.searchParams.append("token", trelloToken);

    const cardsResponse = await fetch(cardsUrl.toString());
    if (!cardsResponse.ok) {
      return res
        .status(400)
        .json({ error: `Trello cards error: ${cardsResponse.status}` });
    }

    const cards = await cardsResponse.json();
    console.log(`📊 Encontradas ${cards.length} tarjetas`);

    let updated = 0;
    let checklistsAdded = 0;

    for (const card of cards) {
      // Extraer reference_code del nombre (formato: "REF - Dirección")
      const match = card.name.match(/^([A-Z0-9]+)\s-/);
      if (!match) {
        console.log(`  ⏭️ Saltando tarjeta sin reference_code: ${card.name}`);
        continue;
      }

      const refCode = match[1];
      console.log(`\n  🔍 Procesando ${refCode}...`);

      // 2. Buscar propiedad en Tokko
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
        bounding_box: [],
      };

      const searchUrl = new URL(
        "https://www.tokkobroker.com/api/v1/property/search/"
      );
      searchUrl.searchParams.append("key", team.tokko_api_key);
      searchUrl.searchParams.append("format", "json");
      searchUrl.searchParams.append("lang", "es_ar");
      searchUrl.searchParams.append("data", JSON.stringify(searchData));
      searchUrl.searchParams.append("limit", "500");

      const tokkoResponse = await fetch(searchUrl.toString());
      if (!tokkoResponse.ok) {
        console.log(`    ❌ Error Tokko: ${tokkoResponse.status}`);
        continue;
      }

      const tokkoData = await tokkoResponse.json();
      const property = tokkoData.objects?.[0];

      if (!property) {
        console.log(`    ❌ Propiedad no encontrada en Tokko`);
        continue;
      }

      // 3. Actualizar descripción
      const price = property.operations?.[0]?.amount
        ? `$${property.operations[0].amount.toLocaleString()} ${property.operations[0].currency}`
        : "Precio no disponible";

      const reserveValue = property.operations?.[0]?.amount
        ? `$${(property.operations[0].amount * 0.8).toLocaleString()} ${property.operations[0].currency}`
        : "No especificado";

      const description = `
📍 ${property.address}
🏷️ Ref: ${property.reference_code}
🏢 Tipo: ${property.type?.name || "N/A"}

**DATOS DE PARTES**
Vendedora: 
Compradora: 
Escribanía: 
Banco: 
Fianza: 

**ASESOR**
Captación: ${property.producer?.name || ""}
Venta: ${property.producer?.name || ""}

**ESCRIBANÍA**
Teléfono: 
Mail: 
Contacto escribanía: 

**NOTAS**
Gerente: Leandro Borges Do Canto
Operación: Venta - Valor: ${price}
Valor de reserva: ${reserveValue}
Fecha estimada de firma: 
Fecha de creación: ${new Date().toLocaleDateString("es-AR")}
Duración de la reserva: 15 días
`.trim();

      const updateUrl = new URL(`https://api.trello.com/1/cards/${card.id}`);
      updateUrl.searchParams.append("key", trelloKey);
      updateUrl.searchParams.append("token", trelloToken);

      const updateResponse = await fetch(updateUrl.toString(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desc: description,
        }),
      });

      if (updateResponse.ok) {
        console.log(`    ✅ Descripción actualizada`);
        updated++;
      } else {
        console.log(`    ❌ Error actualizando descripción`);
      }

      // 4. Agregar checklists si no existen
      const cardDetailsUrl = new URL(`https://api.trello.com/1/cards/${card.id}`);
      cardDetailsUrl.searchParams.append("key", trelloKey);
      cardDetailsUrl.searchParams.append("token", trelloToken);

      const detailsResponse = await fetch(cardDetailsUrl.toString());
      const cardDetails = await detailsResponse.json();
      const hasChecklists = cardDetails.idChecklists?.length > 0;

      if (!hasChecklists) {
        console.log(`    📝 Agregando checklists...`);

        // Checklist 1
        const cl1Url = new URL("https://api.trello.com/1/checklists");
        cl1Url.searchParams.append("key", trelloKey);
        cl1Url.searchParams.append("token", trelloToken);
        cl1Url.searchParams.append("idCard", card.id);
        cl1Url.searchParams.append("name", "EVOLUCIÓN DE CARPETA");

        const cl1Resp = await fetch(cl1Url.toString(), { method: "POST" });
        if (cl1Resp.ok) {
          const cl1 = await cl1Resp.json();
          const items = [
            "Aceptación firmada",
            "Informes Solicitados",
            "Informes Recibidos",
            "Cédula Catastral Solicitada",
            "Cédula Catastral Recibida",
          ];

          for (const item of items) {
            const itemUrl = new URL(
              `https://api.trello.com/1/checklists/${cl1.id}/checkItems`
            );
            itemUrl.searchParams.append("key", trelloKey);
            itemUrl.searchParams.append("token", trelloToken);
            itemUrl.searchParams.append("name", item);
            await fetch(itemUrl.toString(), { method: "POST" });
          }

          console.log(`    ✅ Checklist 1 creado`);
        }

        // Checklist 2
        const cl2Url = new URL("https://api.trello.com/1/checklists");
        cl2Url.searchParams.append("key", trelloKey);
        cl2Url.searchParams.append("token", trelloToken);
        cl2Url.searchParams.append("idCard", card.id);
        cl2Url.searchParams.append("name", "EVOLUCIÓN CREDITICIA");

        const cl2Resp = await fetch(cl2Url.toString(), { method: "POST" });
        if (cl2Resp.ok) {
          const cl2 = await cl2Resp.json();
          const items = [
            "Tasador asignado",
            "Tasación hecha",
            "Crédito aprobado",
            "Escribanía Asignada",
          ];

          for (const item of items) {
            const itemUrl = new URL(
              `https://api.trello.com/1/checklists/${cl2.id}/checkItems`
            );
            itemUrl.searchParams.append("key", trelloKey);
            itemUrl.searchParams.append("token", trelloToken);
            itemUrl.searchParams.append("name", item);
            await fetch(itemUrl.toString(), { method: "POST" });
          }

          console.log(`    ✅ Checklist 2 creado`);
          checklistsAdded++;
        }
      } else {
        console.log(`    ⏭️ Ya tiene checklists, saltado`);
      }
    }

    console.log(`\n✅ Sincronización completada`);

    res.status(200).json({
      success: true,
      message: `Sincronización completada`,
      cardsProcessed: cards.length,
      descriptionUpdated: updated,
      checklistsAdded: checklistsAdded,
    });
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: error.message });
  }
}
