/**
 * lib/systemeSync.ts
 * Motor de sincronización Tokko → Systeme.io
 * Portado del script Python SincronizadorDeContactos
 */

interface TokkoContact {
  id: number;
  email: string;
  name: string;
  cellphone?: string;
  created_at?: string;
  deleted_at?: string;
  tags?: { name: string }[];
  agent?: { name?: string; email?: string } | null;
  lead_status?: string;
  is_owner?: boolean;
}

interface SystemeContact {
  id: number;
  email: string;
  tags?: { id: number; name: string }[];
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetail?: string;
}

// ── Tokko ──────────────────────────────────────────────────────────────────

export async function fetchTokkoContactsToday(tokkoKey: string): Promise<TokkoContact[]> {
  const today = new Date().toISOString().split("T")[0];
  const base = "https://tokkobroker.com";
  const contacts: TokkoContact[] = [];
  const seen = new Set<string>();

  // Contactos editados hoy (deleted_at__gt es el campo real para "modificados")
  async function paginate(startUrl: string) {
    let currentUrl: string | null = startUrl;
    while (currentUrl) {
      const fetchUrl: string = currentUrl;
      const r: Response = await fetch(fetchUrl, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`Tokko error ${r.status}`);
      const data = await r.json();
      for (const c of (data.objects ?? []) as TokkoContact[]) {
        if (c.email && !seen.has(c.email)) {
          seen.add(c.email);
          contacts.push(c);
        }
      }
      const next: string | undefined = data.meta?.next;
      currentUrl = next ? `${base}${next}` : null;
    }
  }

  await paginate(`${base}/api/v1/contact/?key=${tokkoKey}&deleted_at__gt=${today}&format=json`);
  await paginate(`${base}/api/v1/contact/?key=${tokkoKey}&created_at__gt=${today}&format=json`);

  return contacts;
}

// ── Procesamiento de contacto ──────────────────────────────────────────────

function normalizePhone(phone: string | undefined): string {
  if (!phone) return "";
  const clean = phone.replace(/[+\-\s]/g, "");
  return clean.startsWith("549") ? clean : "";
}

function classifyStatus(status: string | undefined): string {
  if (status === "Cerrado") return "Cerrado";
  if (status === "Perdidos") return "Perdido";
  return "Activo";
}

function splitName(fullName: string): { first_name: string; surname: string } {
  const parts = fullName.trim().split(/\s+/);
  const first_name = parts.shift() ?? "";
  const surname = parts.join(" ") || "-";
  return { first_name, surname };
}

// ── Systeme.io API ─────────────────────────────────────────────────────────

async function systemeGet(path: string, key: string) {
  const r = await fetchWithRetry429(`https://api.systeme.io${path}`, {
    method: "GET",
    headers: { "X-API-Key": key, accept: "application/json" },
  });
  if (!r.ok) throw new Error(`Systeme GET ${path} → ${r.status}`);
  return r.json();
}

async function fetchWithRetry429(url: string, opts: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) });
    if (r.status !== 429) return r;
    const wait = parseInt(r.headers.get("Retry-After") ?? "60") + 3;
    await sleep(wait * 1000);
  }
  throw new Error("429 persistente tras reintentos");
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }



async function fetchSystemeTags(key: string): Promise<{ id: number; name: string }[]> {
  const allTags: { id: number; name: string }[] = [];
  let lastId: number | null = null;
  while (true) {
    const url = lastId ? `/api/tags?limit=100&startingAfter=${lastId}` : "/api/tags?limit=100";
    const data = await systemeGet(url, key);
    const items: { id: number; name: string }[] = data.items ?? [];
    allTags.push(...items);
    if (items.length < 100) break;
    lastId = items[items.length - 1].id;
  }
  return allTags;
}

async function getOrCreateTag(name: string, existingTags: { id: number; name: string }[], key: string): Promise<number | null> {
  const found = existingTags.find(t => t.name === name);
  if (found) return found.id;

  const r = await fetchWithRetry429("https://api.systeme.io/api/tags", {
    method: "POST",
    headers: { "X-API-Key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) {
    const errBody = await r.text().catch(() => "");
    // Si ya existe (422), buscarla por nombre en el listado actual
    if (r.status === 422 && errBody.includes("ya se ha utilizado")) {
      // Recargar tags de Systeme para encontrarla
      const refreshed = await fetchSystemeTags(key);
      const found2 = refreshed.find(t => t.name === name);
      if (found2) {
        existingTags.push(found2);
        return found2.id;
      }
    }
    throw new Error(`No se pudo crear tag "${name}" en Systeme → ${r.status}: ${errBody.slice(0, 150)}`);
  }
  const d = await r.json();
  const newTag = { id: d.id as number, name };
  existingTags.push(newTag);
  return d.id as number;
}

// Cache de contactos de Systeme: email.toLowerCase() → id
// Se carga una vez al inicio de la corrida paginando con hasMore/startingAfter
async function loadSystemeContactsCache(key: string): Promise<Map<string, number>> {
  const cache = new Map<string, number>();
  let startingAfter: number | null = null;
  let hasMore = true;

  while (hasMore) {
    const url = startingAfter
      ? `https://api.systeme.io/api/contacts?limit=100&startingAfter=${startingAfter}`
      : "https://api.systeme.io/api/contacts?limit=100";

    const r: Response = await fetchWithRetry429(url, {
      method: "GET",
      headers: { "X-API-Key": key, accept: "application/json" },
    });
    if (!r.ok) throw new Error(`Systeme GET /api/contacts → ${r.status}`);

    const d = await r.json();
    const items: { id: number; email: string }[] = d.items ?? [];
    for (const item of items) {
      if (item.email) cache.set(item.email.toLowerCase(), item.id);
    }
    hasMore = d.hasMore === true && items.length > 0;
    if (hasMore) startingAfter = items[items.length - 1].id;
  }
  return cache;
}

// Errores de email inválido de Systeme — se skipean, no son errores nuestros
const INVALID_EMAIL_MSGS = ["no es válida", "not a valid email", "invalid email", "carece de un"];

async function createContact(payload: Record<string, unknown>, key: string): Promise<{ id: number } | null> {
  const r = await fetchWithRetry429("https://api.systeme.io/api/contacts", {
    method: "POST",
    headers: { "X-API-Key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (r.status === 201) return r.json();
  const errBody = await r.text().catch(() => "");
  // Email inválido según Systeme → retornar null para skipear sin error
  if (r.status === 422 && INVALID_EMAIL_MSGS.some(m => errBody.includes(m))) return null;
  throw new Error(`Systeme POST /api/contacts → ${r.status}: ${errBody.slice(0, 200)}`);
}



async function updateContact(id: number, payload: Record<string, unknown>, key: string): Promise<void> {
  await fetchWithRetry429(`https://api.systeme.io/api/contacts/${id}`, {
    method: "PATCH",
    headers: { "X-API-Key": key, "content-type": "application/merge-patch+json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
}

async function syncTags(
  contactId: number,
  desiredTagNames: string[],
  currentTags: { id: number; name: string }[],
  allTags: { id: number; name: string }[],
  key: string
): Promise<void> {
  const currentNames = new Set(currentTags.map(t => t.name));
  const desiredNamesArr = Array.from(new Set(desiredTagNames));

  // Agregar las que faltan
  for (const name of desiredNamesArr) {
    if (!currentNames.has(name)) {
      const tagId = await getOrCreateTag(name, allTags, key);
      if (tagId) {
        const tr = await fetchWithRetry429(`https://api.systeme.io/api/contacts/${contactId}/tags`, {
          method: "POST",
          headers: { "X-API-Key": key, "content-type": "application/json" },
          body: JSON.stringify({ tagId }),
        });
        if (!tr.ok) {
          const tbody = await tr.text().catch(() => "");
          throw new Error(`Tag assign "${name}" → ${tr.status}: ${tbody.slice(0, 150)}`);
        }
      }
    }
  }

  // Quitar las que sobran (solo las que InmoCoach maneja — no tocamos tags manuales del usuario)
  const desiredNamesSet = new Set(desiredNamesArr);
  for (const ct of currentTags) {
    if (!desiredNamesSet.has(ct.name) && allTags.some(t => t.name === ct.name)) {
      await fetchWithRetry429(`https://api.systeme.io/api/contacts/${contactId}/tags/${ct.id}`, {
        method: "DELETE",
        headers: { "X-API-Key": key },
      });
    }
  }
}

// ── Función principal ──────────────────────────────────────────────────────

export async function runSync(params: {
  tokkoKey: string;
  systemeKey: string;
  whitelistTags: string[];
  fixedTags: string[];
  overrideContacts?: TokkoContact[]; // para backfill — omitir la query de hoy
}): Promise<SyncResult> {
  const { tokkoKey, systemeKey, whitelistTags, fixedTags, overrideContacts } = params;
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const errors: string[] = [];

  // 1. Traer contactos — usar overrideContacts si se provee (backfill)
  let contacts: TokkoContact[] = [];
  if (overrideContacts) {
    contacts = overrideContacts;
  } else {
    try {
      contacts = await fetchTokkoContactsToday(tokkoKey);
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : "Error desconocido";
      result.errors++;
      result.errorDetail = `Error al traer contactos de Tokko: ${msg}`;
      return result;
    }
  }

  if (contacts.length === 0) {
    result.errorDetail = "Tokko no devolvió contactos para hoy (0 resultados)";
    return result;
  }

  // contacts.length disponible para debug si se necesita

  // 2. Cargar tags de Systeme una sola vez
  let systemeTags: { id: number; name: string }[] = [];
  try {
    systemeTags = await fetchSystemeTags(systemeKey);
  } catch (tagsErr: unknown) {
    const tagsMsg = tagsErr instanceof Error ? tagsErr.message : "Error";
    result.errors++;
    result.errorDetail = `Error al cargar tags de Systeme: ${tagsMsg}`;
    return result;
  }

  // 2b. Pre-crear las tags fijas en Systeme si no existen, para tenerlas listas
  for (const fixedTag of fixedTags) {
    try {
      await getOrCreateTag(fixedTag, systemeTags, systemeKey);
    } catch (tagErr: unknown) {
      const tagMsg = tagErr instanceof Error ? tagErr.message : "Error";
      result.errors++;
      errors.push(`Pre-crear tag fija "${fixedTag}": ${tagMsg}`);
    }
  }

  // 2c. Cargar cache de todos los contactos existentes en Systeme (email → id)
  // El script Python original hace esto para evitar la falta de búsqueda por email en la API
  let contactsCache = new Map<string, number>();
  try {
    contactsCache = await loadSystemeContactsCache(systemeKey);
  } catch (cacheErr: unknown) {
    const cacheMsg = cacheErr instanceof Error ? cacheErr.message : "Error";
    result.errors++;
    result.errorDetail = `Error al cargar contactos de Systeme: ${cacheMsg}`;
    return result;
  }

  // 3. Procesar cada contacto
  for (const contact of contacts) {
      // Sin email → no se puede sincronizar en Systeme
      if (!contact.email?.trim()) { result.skipped++; continue; }

    try {
      const { first_name, surname } = splitName(contact.name ?? "");
      const phone = normalizePhone(contact.cellphone);
      const status = classifyStatus(contact.lead_status);
      const agentName = contact.agent?.name ?? "";
      const agentEmail = contact.agent?.email ?? "";

      // Tags: filtrar por whitelist + agregar fijas + is_owner si aplica
      const tokkoTagNames = (contact.tags ?? []).map(t => t.name);
      const filteredTags = whitelistTags.length > 0
        ? tokkoTagNames.filter(n => whitelistTags.includes(n))
        : tokkoTagNames;

      const allDesiredTags = Array.from(new Set([
        ...fixedTags,
        ...filteredTags,
        ...(contact.is_owner ? ["is_owner"] : []),
        status,
      ]));

      // Payload del contacto
      // Omitir campos con valor vacío — Systeme rechaza fields[n].value en blanco
      const fields: { slug: string; value: string }[] = [
        { slug: "surname", value: surname },
        { slug: "status", value: status },
        ...(phone ? [{ slug: "phone_number", value: phone }] : []),
        ...(agentName ? [{ slug: "agent_name", value: agentName }] : []),
        ...(agentEmail ? [{ slug: "agent_email", value: agentEmail }] : []),
      ].filter(f => f.value.trim() !== "");

      const payload = {
        email: contact.email.trim(),
        firstName: first_name,
        locale: "es",
        fields,
      };

      // Buscar en cache local si el contacto ya existe en Systeme
      const emailKey = contact.email.trim().toLowerCase();
      const existingId = contactsCache.get(emailKey);

      if (!existingId) {
        // Crear nuevo contacto
        const created = await createContact(payload, systemeKey);
        if (created) {
          contactsCache.set(emailKey, created.id); // actualizar cache
          await syncTags(created.id, allDesiredTags, [], systemeTags, systemeKey);
          result.created++;
        } else {
          result.skipped++; // email inválido según Systeme
        }
      } else {
        // Actualizar contacto existente
        await updateContact(existingId, payload, systemeKey);
        await syncTags(existingId, allDesiredTags, [], systemeTags, systemeKey);
        result.updated++;
      }
    } catch (err: unknown) {
      result.errors++;
      const msg = err instanceof Error ? err.message : "Error desconocido";
      errors.push(`${contact.email}: ${msg}`);
    }
  }

  if (errors.length > 0) {
    result.errorDetail = errors.slice(0, 10).join("\n");
  } else if (result.created === 0 && result.updated === 0 && result.skipped === 0) {
    result.errorDetail = `Se procesaron ${contacts.length} contactos de Tokko pero ninguno requirió cambios en Systeme`;
  }

  return result;
}
