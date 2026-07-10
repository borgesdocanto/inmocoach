import { supabaseAdmin } from "./supabase";

interface ReservedProperty {
  id: number;
  address: string;
  reference_code: string;
  status: number;
  producer?: { name: string; email: string };
  branch?: { name: string };
  photos: Array<{ image: string }>;
  type?: { name: string };
  operations?: Array<{ amount: number; currency: string }>;
}

interface TrelloCard {
  id: string;
  name: string;
  idBoard: string;
  idList: string;
}

export async function getReservedPropertiesBranch(
  apiKey: string,
  branchId: number = 62
): Promise<ReservedProperty[]> {
  console.log(`🔄 Trayendo propiedades reservadas (branch ${branchId})...`);

  const searchData = {
    filters: [["branch_id", "", String(branchId)]],
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

  const url = new URL("https://www.tokkobroker.com/api/v1/property/search/");
  url.searchParams.append("key", apiKey);
  url.searchParams.append("format", "json");
  url.searchParams.append("lang", "es_ar");
  url.searchParams.append("data", JSON.stringify(searchData));
  url.searchParams.append("limit", "500");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Tokko API error: ${response.status}`);
  }

  const data = await response.json();
  const props = data.objects || [];
  console.log(`✅ ${props.length} propiedades reservadas encontradas`);
  return props;
}

export async function createTrelloCard(
  property: ReservedProperty,
  listId: string,
  trelloKey: string,
  trelloToken: string
): Promise<TrelloCard | null> {
  try {
    const description = `
**Propiedad Reservada**

📍 Dirección: ${property.address}
📋 Ref: ${property.reference_code}
👤 Agente: ${property.producer?.name || "N/A"}
📧 Email: ${property.producer?.email || "N/A"}
🏘️ Zona: ${property.branch?.name || "N/A"}
📸 Fotos: ${property.photos?.length || 0}
🏷️ Tipo: ${property.type?.name || "N/A"}

${property.operations?.[0] ? `💰 Monto: ${property.operations[0].amount} ${property.operations[0].currency}` : ""}
    `.trim();

    const cardData = {
      name: `${property.address} (${property.reference_code})`,
      desc: description,
      idList: listId,
      pos: "bottom",
    };

    // Obtener foto de portada si existe
    const coverPhotoUrl = property.photos?.[0]?.image;

    const cardResponse = await fetch("https://api.trello.com/1/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...cardData,
        key: trelloKey,
        token: trelloToken,
      }),
    });

    if (!cardResponse.ok) {
      throw new Error(`Trello error: ${cardResponse.status}`);
    }

    const card = await cardResponse.json();

    // Agregar foto de portada si existe
    if (coverPhotoUrl) {
      await fetch(`https://api.trello.com/1/cards/${card.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: coverPhotoUrl,
          name: `Foto principal - ${property.reference_code}`,
          key: trelloKey,
          token: trelloToken,
          setCover: true,
        }),
      });
    }

    console.log(`✅ Tarjeta creada: ${card.id}`);
    return card;
  } catch (error) {
    console.error(`❌ Error creando tarjeta para ${property.reference_code}:`, error);
    return null;
  }
}

export async function syncReservedToTrello(
  teamId: string,
  trelloKey: string,
  trelloToken: string,
  trelloBoardId: string,
  branchId: number = 62
): Promise<{ success: boolean; created: number; error?: string }> {
  try {
    console.log(`🔄 Iniciando sincronización Trello para branch ${branchId}...`);

    // Obtener API key de Tokko
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", teamId)
      .single();

    if (!team?.tokko_api_key) {
      throw new Error("No Tokko API key found");
    }

    // Traer propiedades reservadas
    const properties = await getReservedPropertiesBranch(team.tokko_api_key, branchId);

    // Obtener listas de Trello del board
    const boardResponse = await fetch(
      `https://api.trello.com/1/boards/${trelloBoardId}/lists?key=${trelloKey}&token=${trelloToken}`
    );
    if (!boardResponse.ok) {
      throw new Error("Error fetching Trello board");
    }

    const lists = await boardResponse.json();
    const targetList = lists[0]; // Usar la primera lista

    if (!targetList) {
      throw new Error("No lists found in Trello board");
    }

    // Crear tarjetas
    let createdCount = 0;
    const syncLog = {
      team_id: teamId,
      status: "running",
      properties_found: properties.length,
      cards_created: 0,
      started_at: new Date(),
      errors: [] as string[],
    };

    for (const prop of properties) {
      const card = await createTrelloCard(prop, targetList.id, trelloKey, trelloToken);
      if (card) {
        createdCount++;
      } else {
        syncLog.errors.push(`Error: ${prop.reference_code}`);
      }
    }

    syncLog.cards_created = createdCount;
    syncLog.status = "completed";

    // Guardar log en Supabase
    await supabaseAdmin.from("trello_sync_log").insert([syncLog]);

    console.log(`✅ Sincronización completada: ${createdCount} tarjetas creadas`);
    return { success: true, created: createdCount };
  } catch (error: any) {
    console.error("❌ Error en sincronización:", error.message);
    return { success: false, created: 0, error: error.message };
  }
}
