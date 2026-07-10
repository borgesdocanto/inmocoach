import { supabaseAdmin } from "./supabase";

interface ReservedProperty {
  id: number;
  address: string;
  reference_code: string;
  status: number;
  producer?: { name: string; email: string };
  created_by?: { email: string };
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
  idMembers: string[];
}

interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
}

interface TrelloMember {
  id: string;
  email: string;
  fullName: string;
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
  const properties = data.objects || [];
  console.log(`✅ Obtenidas ${properties.length} propiedades reservadas`);

  return properties;
}

// Obtener todas las tarjetas del tablero
async function getBoardCards(
  boardId: string,
  key: string,
  token: string
): Promise<TrelloCard[]> {
  const url = new URL(`https://api.trello.com/1/boards/${boardId}/cards`);
  url.searchParams.append("key", key);
  url.searchParams.append("token", token);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Trello: ${response.status}`);

  const cards = await response.json();
  return cards;
}

// Obtener todos los miembros del tablero
async function getBoardMembers(
  boardId: string,
  key: string,
  token: string
): Promise<Map<string, string>> {
  const url = new URL(`https://api.trello.com/1/boards/${boardId}/members`);
  url.searchParams.append("key", key);
  url.searchParams.append("token", token);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Trello members: ${response.status}`);

  const members = await response.json();
  const emailToId = new Map<string, string>();

  for (const member of members) {
    if (member.email) {
      emailToId.set(member.email.toLowerCase(), member.id);
    }
  }

  console.log(`✅ Obtenidos ${emailToId.size} miembros del tablero`);
  return emailToId;
}

// Obtener o crear lista "Vendida"
async function ensureVendidaList(
  boardId: string,
  key: string,
  token: string
): Promise<string> {
  // Obtener todas las listas
  const url = new URL(`https://api.trello.com/1/boards/${boardId}/lists`);
  url.searchParams.append("key", key);
  url.searchParams.append("token", token);

  let response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Trello lists: ${response.status}`);

  const lists: TrelloList[] = await response.json();
  const vendidaList = lists.find((l) => l.name === "Vendida" && !l.closed);

  if (vendidaList) {
    return vendidaList.id;
  }

  // Crear lista "Vendida" si no existe
  console.log("📝 Creando lista 'Vendida'...");
  const createUrl = new URL("https://api.trello.com/1/lists");
  createUrl.searchParams.append("key", key);
  createUrl.searchParams.append("token", token);
  createUrl.searchParams.append("name", "Vendida");
  createUrl.searchParams.append("idBoard", boardId);

  response = await fetch(createUrl.toString(), {
    method: "POST",
  });

  if (!response.ok) throw new Error(`Trello create list: ${response.status}`);
  const newList = await response.json();
  console.log(`✅ Lista 'Vendida' creada: ${newList.id}`);
  return newList.id;
}

// Agregar miembros a una tarjeta
async function addMembersToCard(
  cardId: string,
  memberEmails: string[],
  emailToId: Map<string, string>,
  key: string,
  token: string
): Promise<void> {
  const url = new URL(`https://api.trello.com/1/cards/${cardId}`);
  url.searchParams.append("key", key);
  url.searchParams.append("token", token);

  // Obtener miembros actuales
  const getResponse = await fetch(url.toString());
  if (!getResponse.ok) return;
  const card = await getResponse.json();
  const currentMemberIds = new Set(card.idMembers || []);

  // Agregar nuevos miembros
  const memberIds: string[] = [];
  for (const email of memberEmails) {
    const memberId = emailToId.get(email.toLowerCase());
    if (memberId && !currentMemberIds.has(memberId)) {
      memberIds.push(memberId);
    }
  }

  if (memberIds.length === 0) {
    console.log(`  → Sin nuevos miembros para agregar a ${cardId}`);
    return;
  }

  // Actualizar tarjeta con nuevos miembros
  const updateUrl = new URL(`https://api.trello.com/1/cards/${cardId}`);
  updateUrl.searchParams.append("key", key);
  updateUrl.searchParams.append("token", token);

  const newMemberIds = Array.from(currentMemberIds).concat(memberIds);
  const updateResponse = await fetch(updateUrl.toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idMembers: newMemberIds,
    }),
  });

  if (updateResponse.ok) {
    console.log(`  ✅ ${memberIds.length} miembros agregados a tarjeta`);
  }
}

// Crear o actualizar tarjeta
async function createOrUpdateTrelloCard(
  property: ReservedProperty,
  listId: string,
  emailToId: Map<string, string>,
  key: string,
  token: string,
  existingCard?: TrelloCard
): Promise<TrelloCard | null> {
  const cardTitle = `${property.reference_code} - ${property.address}`;
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
Fecha de creación: ${new Date().toLocaleDateString('es-AR')}
Duración de la reserva: 15 días
`.trim();

  if (existingCard) {
    // Actualizar tarjeta existente
    console.log(`  📝 Actualizando tarjeta ${existingCard.id}...`);
    const url = new URL(`https://api.trello.com/1/cards/${existingCard.id}`);
    url.searchParams.append("key", key);
    url.searchParams.append("token", token);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cardTitle,
        desc: description,
        idList: listId,
      }),
    });

    if (!response.ok) {
      console.error(`❌ Error actualizando tarjeta: ${response.status}`);
      return null;
    }

    const updatedCard = await response.json();
    console.log(`  ✅ Tarjeta actualizada`);
    return updatedCard;
  } else {
    // Crear tarjeta nueva
    console.log(`  ✨ Creando tarjeta nueva para ${property.reference_code}...`);
    const url = new URL("https://api.trello.com/1/cards");
    url.searchParams.append("key", key);
    url.searchParams.append("token", token);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cardTitle,
        desc: description,
        idList: listId,
      }),
    });

    if (!response.ok) {
      console.error(`❌ Error creando tarjeta: ${response.status}`);
      return null;
    }

    const card = await response.json();
    console.log(`  ✅ Tarjeta creada: ${card.id}`);
    return card;
  }
}

// Sincronización completa e idempotente
export async function syncReservedToTrello(
  teamId: string,
  trelloKey: string,
  trelloToken: string,
  trelloBoardId: string,
  branchId: number = 62
): Promise<{ success: boolean; created: number; updated: number; error?: string }> {
  try {
    console.log("🚀 Iniciando sync idempotente de propiedades reservadas...");

    // 1. Obtener propiedades reservadas de Tokko
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("tokko_api_key")
      .eq("id", teamId)
      .single();

    if (!teams?.tokko_api_key) {
      return { success: false, created: 0, updated: 0, error: "Tokko API key not configured" };
    }

    const properties = await getReservedPropertiesBranch(teams.tokko_api_key, branchId);

    // 2. Obtener tarjetas existentes y miembros
    const existingCards = await getBoardCards(trelloBoardId, trelloKey, trelloToken);
    const emailToId = await getBoardMembers(trelloBoardId, trelloKey, trelloToken);
    const vendidaListId = await ensureVendidaList(trelloBoardId, trelloKey, trelloToken);

    console.log(`📊 ${existingCards.length} tarjetas existentes`);

    // 3. Mapear propiedades por reference_code para buscar rápido
    const propertyMap = new Map(properties.map((p) => [p.reference_code, p]));

    // 4. Procesar cada propiedad reservada
    let created = 0;
    let updated = 0;

    for (const property of properties) {
      const existingCard = existingCards.find(
        (c) => c.name.includes(property.reference_code)
      );

      const cardData = await createOrUpdateTrelloCard(
        property,
        existingCard?.idList || trelloBoardId,
        emailToId,
        trelloKey,
        trelloToken,
        existingCard
      );

      if (!cardData) continue;

      // 5. Agregar miembros a la tarjeta
      const membersToAdd = [
        property.producer?.email,
        property.created_by?.email,
        "leandro@galas.com.ar",
        "luciana@galas.com.ar",
      ].filter(Boolean) as string[];

      await addMembersToCard(cardData.id, membersToAdd, emailToId, trelloKey, trelloToken);

      // Crear checklists (solo si es tarjeta nueva, para no duplicar)
      if (!existingCard) {
        await createChecklistsForCard(cardData.id, trelloKey, trelloToken);
      }

      if (existingCard) {
        updated++;
      } else {
        created++;
      }
    }

    // 6. Mover tarjetas huérfanas a "Vendida"
    let movedToVendida = 0;
    for (const card of existingCards) {
      // Extraer reference_code de la tarjeta (está en el nombre)
      const match = card.name.match(/^([A-Z0-9]+)\s-/);
      if (!match) continue;

      const refCode = match[1];
      const stillReserved = propertyMap.has(refCode);

      if (!stillReserved && card.idList !== vendidaListId) {
        console.log(`📦 Moviendo ${refCode} a lista Vendida...`);

        const url = new URL(`https://api.trello.com/1/cards/${card.id}`);
        url.searchParams.append("key", trelloKey);
        url.searchParams.append("token", trelloToken);

        const response = await fetch(url.toString(), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idList: vendidaListId }),
        });

        if (response.ok) {
          movedToVendida++;
        }
      }
    }

    // 7. Registrar en base de datos
    await supabaseAdmin.from("trello_sync_log").insert({
      team_id: teamId,
      status: "completed",
      properties_found: properties.length,
      cards_created: created,
      cards_updated: updated,
      cards_moved: movedToVendida,
      completed_at: new Date().toISOString(),
    });

    const summary = `✅ Sync completado: ${created} creadas, ${updated} actualizadas, ${movedToVendida} movidas a Vendida`;
    console.log(summary);

    return {
      success: true,
      created: created + updated,
      updated: updated,
    };
  } catch (error: any) {
    console.error("❌ Sync error:", error.message);

    await supabaseAdmin.from("trello_sync_log").insert({
      team_id: teamId,
      status: "failed",
      properties_found: 0,
      cards_created: 0,
      cards_updated: 0,
      errors: error.message,
      completed_at: new Date().toISOString(),
    });

    return {
      success: false,
      created: 0,
      updated: 0,
      error: error.message,
    };
  }
}

// Crear checklists en una tarjeta
async function createChecklistsForCard(
  cardId: string,
  key: string,
  token: string
): Promise<void> {
  try {
    // Checklist 1: EVOLUCIÓN DE CARPETA
    const checklist1Url = new URL("https://api.trello.com/1/checklists");
    checklist1Url.searchParams.append("key", key);
    checklist1Url.searchParams.append("token", token);
    checklist1Url.searchParams.append("idCard", cardId);
    checklist1Url.searchParams.append("name", "EVOLUCIÓN DE CARPETA");

    const response1 = await fetch(checklist1Url.toString(), {
      method: "POST",
    });

    if (response1.ok) {
      const checklist1 = await response1.json();
      const items1 = [
        "Aceptación firmada",
        "Informes Solicitados",
        "Informes Recibidos",
        "Cédula Catastral Solicitada",
        "Cédula Catastral Recibida",
      ];

      for (const item of items1) {
        const itemUrl = new URL(
          `https://api.trello.com/1/checklists/${checklist1.id}/checkItems`
        );
        itemUrl.searchParams.append("key", key);
        itemUrl.searchParams.append("token", token);
        itemUrl.searchParams.append("name", item);

        await fetch(itemUrl.toString(), {
          method: "POST",
        });
      }

      console.log(`  ✅ Checklist "EVOLUCIÓN DE CARPETA" creado`);
    }

    // Checklist 2: EVOLUCIÓN CREDITICIA
    const checklist2Url = new URL("https://api.trello.com/1/checklists");
    checklist2Url.searchParams.append("key", key);
    checklist2Url.searchParams.append("token", token);
    checklist2Url.searchParams.append("idCard", cardId);
    checklist2Url.searchParams.append("name", "EVOLUCIÓN CREDITICIA");

    const response2 = await fetch(checklist2Url.toString(), {
      method: "POST",
    });

    if (response2.ok) {
      const checklist2 = await response2.json();
      const items2 = [
        "Tasador asignado",
        "Tasación hecha",
        "Crédito aprobado",
        "Escribanía Asignada",
      ];

      for (const item of items2) {
        const itemUrl = new URL(
          `https://api.trello.com/1/checklists/${checklist2.id}/checkItems`
        );
        itemUrl.searchParams.append("key", key);
        itemUrl.searchParams.append("token", token);
        itemUrl.searchParams.append("name", item);

        await fetch(itemUrl.toString(), {
          method: "POST",
        });
      }

      console.log(`  ✅ Checklist "EVOLUCIÓN CREDITICIA" creado`);
    }
  } catch (error: any) {
    console.error("  ⚠️ Error creando checklists:", error.message);
  }
}
