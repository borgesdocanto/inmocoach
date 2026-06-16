/**
 * lib/systemeSync.ts
 * Motor de sincronización Tokko → Systeme.io
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

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetail?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function normalizePhone(phone: string | undefined): string {
  if (!phone) return "1111111111111";
  const clean = phone.replace(/[+\-\s]/g, "");
  return clean.startsWith("549") ? clean : "1111111111111";
}

function classifyStatus(status: string | undefined): string {
  if (status === "Cerrado") return "Cerrado";
  if (status === "Perdidos") return "Perdido";
  return "Activo";
}

function splitName(fullName: string): { first_name: string; surname: string } {
  const parts = (fullName || "").trim().split(/\s+/);
  const first_name = parts.shift() ?? "";
  const surname = parts.join(" ") || "-";
  return { first_name, surname };
}

function normalizeTagName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// ── HTTP ───────────────────────────────────────────────────────────────────

async function fetchWithRetry429(url: string, opts: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) });
    if (r.status !== 429) return r;
    const wait = parseInt(r.headers.get("Retry-After") ?? "60") + 3;
    await sleep(wait * 1000);
  }
  throw new Error("429 persistente tras reintentos");
}

// ── Tokko ──────────────────────────────────────────────────────────────────

export async function fetchTokkoContactsToday(tokkoKey: string): Promise<TokkoContact[]> {
  // Traer desde AYER en lugar de hoy: elimina gaps sin importar a qué hora corra el cron.
  // Re-sincronizar un contacto ya sincronizado es inofensivo (upsert idempotente).
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const today = yesterday.toISOString().split("T")[0];
  const base = "https://tokkobroker.com";
  const contacts: TokkoContact[] = [];
  const seen = new Set<string>();

  async function paginate(startUrl: string) {
    let currentUrl: string | null = startUrl;
    while (currentUrl) {
      const fetchUrl: string = currentUrl;
      const r: Response = await fetch(fetchUrl, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`Tokko error ${r.status}`);
      const data = await r.json();
      for (const c of (data.objects ?? []) as TokkoContact[]) {
        if (c.email && !seen.has(c.email.toLowerCase())) {
          seen.add(c.email.toLowerCase());
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

// ── Systeme Tags ───────────────────────────────────────────────────────────

async function fetchAllSystemeTags(key: string): Promise<{ id: number; name: string }[]> {
  const allTags: { id: number; name: string }[] = [];
  let lastId: number | null = null;
  while (true) {
    const url = lastId
      ? `https://api.systeme.io/api/tags?limit=100&startingAfter=${lastId}`
      : "https://api.systeme.io/api/tags?limit=100";
    const r: Response = await fetchWithRetry429(url, {
      headers: { "X-API-Key": key, accept: "application/json" },
    });
    if (!r.ok) throw new Error(`Systeme GET /api/tags → ${r.status}`);
    const d = await r.json();
    const items: { id: number; name: string }[] = d.items ?? [];
    allTags.push(...items);
    if (items.length < 100) break;
    lastId = items[items.length - 1].id;
  }
  return allTags;
}

// Obtiene o crea una tag. NUNCA crea duplicados.
async function getOrCreateTag(
  name: string,
  tagsCache: { id: number; name: string }[],
  key: string
): Promise<number | null> {
  // 1. Buscar exacto
  const exact = tagsCache.find(t => t.name === name);
  if (exact) return exact.id;
  // 2. Buscar normalizado
  const normName = normalizeTagName(name);
  const fuzzy = tagsCache.find(t => normalizeTagName(t.name) === normName);
  if (fuzzy) return fuzzy.id;
  // 3. Crear en Systeme
  const r = await fetchWithRetry429("https://api.systeme.io/api/tags", {
    method: "POST",
    headers: { "X-API-Key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ name }),
  });
  if (r.status === 201) {
    const d = await r.json();
    tagsCache.push({ id: d.id as number, name });
    return d.id as number;
  }
  if (r.status === 422) {
    // Ya existe pero no estaba en el cache — recargar
    const refreshed = await fetchAllSystemeTags(key);
    tagsCache.length = 0;
    for (const t of refreshed) tagsCache.push(t);
    const found = refreshed.find(t => t.name === name || normalizeTagName(t.name) === normName);
    if (found) return found.id;
    return null;
  }
  const errBody = await r.text().catch(() => "");
  throw new Error(`Tag "${name}" → ${r.status}: ${errBody.slice(0, 100)}`);
}

async function assignTagsToContact(
  contactId: number,
  tagNames: string[],
  tagsCache: { id: number; name: string }[],
  key: string,
  tagErrors: string[] = []
): Promise<void> {
  const uniqueNames = Array.from(new Set(tagNames));
  for (const name of uniqueNames) {
    try {
      const tagId = await getOrCreateTag(name, tagsCache, key);
      if (!tagId) {
        tagErrors.push(`Tag "${name}": getOrCreateTag devolvió null`);
        continue;
      }
      const r = await fetchWithRetry429(`https://api.systeme.io/api/contacts/${contactId}/tags`, {
        method: "POST",
        headers: { "X-API-Key": key, "content-type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
      if (!r.ok && r.status !== 422) {
        const body = await r.text().catch(() => "");
        tagErrors.push(`Assign "${name}" → ${r.status}: ${body.slice(0, 100)}`);
      }
    } catch (tagErr: unknown) {
      tagErrors.push(`Tag "${name}" excepción: ${tagErr instanceof Error ? tagErr.message : "Error"}`);
    }
  }
}

// ── Systeme Contacts ───────────────────────────────────────────────────────

async function loadContactsCache(key: string): Promise<Map<string, number>> {
  const cache = new Map<string, number>();
  let startingAfter: number | null = null;
  let hasMore = true;
  while (hasMore) {
    const url = startingAfter
      ? `https://api.systeme.io/api/contacts?limit=100&startingAfter=${startingAfter}`
      : "https://api.systeme.io/api/contacts?limit=100";
    const r: Response = await fetchWithRetry429(url, {
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

const INVALID_EMAIL_MSGS = ["no es válida", "not a valid email", "invalid email", "carece de un"];

async function createContact(
  payload: Record<string, unknown>,
  key: string,
  contactsCache: Map<string, number>
): Promise<{ id: number; isNew: boolean } | null> {
  const r = await fetchWithRetry429("https://api.systeme.io/api/contacts", {
    method: "POST",
    headers: { "X-API-Key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (r.status === 201) {
    const d = await r.json();
    return { id: d.id as number, isNew: true };
  }
  const errBody = await r.text().catch(() => "");
  // Email inválido → skip
  if (r.status === 422 && INVALID_EMAIL_MSGS.some(m => errBody.includes(m))) return null;
  // Email ya usado → el contacto existe pero no estaba en el cache — recargar y buscar
  if (r.status === 422 && errBody.includes("ya se ha utilizado")) {
    const email = (payload.email as string).toLowerCase();
    // Recargar cache completo
    const refreshed = await loadContactsCache(key);
    refreshed.forEach((v, k) => contactsCache.set(k, v));
    const existingId = contactsCache.get(email);
    if (existingId) return { id: existingId, isNew: false };
    return null;
  }
  throw new Error(`POST /api/contacts → ${r.status}: ${errBody.slice(0, 200)}`);
}

async function updateContact(id: number, payload: Record<string, unknown>, key: string): Promise<void> {
  await fetchWithRetry429(`https://api.systeme.io/api/contacts/${id}`, {
    method: "PATCH",
    headers: { "X-API-Key": key, "content-type": "application/merge-patch+json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
}

// ── Función principal ──────────────────────────────────────────────────────

export async function runSync(params: {
  tokkoKey: string;
  systemeKey: string;
  whitelistTags: string[];
  fixedTags: string[];
  overrideContacts?: TokkoContact[];
}): Promise<SyncResult> {
  const { tokkoKey, systemeKey, whitelistTags, fixedTags, overrideContacts } = params;
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const errors: string[] = [];

  // 1. Traer contactos de Tokko
  let contacts: TokkoContact[] = [];
  if (overrideContacts) {
    contacts = overrideContacts;
  } else {
    try {
      contacts = await fetchTokkoContactsToday(tokkoKey);
    } catch (err: unknown) {
      result.errors++;
      result.errorDetail = `Error Tokko: ${err instanceof Error ? err.message : "Error"}`;
      return result;
    }
  }
  if (contacts.length === 0) return result;

  // 2. Cargar tags de Systeme (cache mutable)
  const tagsCache: { id: number; name: string }[] = await fetchAllSystemeTags(systemeKey);

  // 3. Pre-crear tags fijas
  for (const tag of fixedTags) {
    await getOrCreateTag(tag, tagsCache, systemeKey).catch(() => null);
  }

  // 4. Cache de contactos existentes
  const contactsCache = await loadContactsCache(systemeKey);

  // 5. Normalizar whitelist
  const whitelistNorm = whitelistTags.map(normalizeTagName);

  // 6. Procesar contactos
  for (const contact of contacts) {
    if (!contact.email?.trim()) { result.skipped++; continue; }
    try {
      const { first_name, surname } = splitName(contact.name ?? "");
      const status = classifyStatus(contact.lead_status);
      const phone = normalizePhone(contact.cellphone);
      const agentName = contact.agent?.name ?? "";
      const agentEmail = contact.agent?.email ?? "";

      const tokkoTagNames = (contact.tags ?? []).map(t => t.name);
      const filteredTokkoTags = whitelistTags.length > 0
        ? tokkoTagNames.filter(n => whitelistNorm.includes(normalizeTagName(n)))
        : tokkoTagNames;

      const desiredTags = Array.from(new Set([
        ...fixedTags,
        ...filteredTokkoTags,
        ...(contact.is_owner ? ["is_owner"] : []),
        status,
      ]));

      // Systeme usa slugs nativos: "first_name" y "surname" en el array fields.
      // Tambien aceptamos firstName/lastName en el toplevel para máxima compatibilidad.
      const fields: { slug: string; value: string }[] = [
        { slug: "first_name", value: first_name },
        { slug: "surname", value: surname === "-" ? "" : surname },
        { slug: "phone_number", value: phone },
        { slug: "status", value: status },
        ...(agentName ? [{ slug: "agent_name", value: agentName }] : []),
        ...(agentEmail ? [{ slug: "agent_email", value: agentEmail }] : []),
      ];

      const payload = {
        email: contact.email.trim(),
        firstName: first_name,
        lastName: surname === "-" ? "" : surname,
        locale: "es",
        fields,
      };
      const emailKey = contact.email.trim().toLowerCase();
      const existingId = contactsCache.get(emailKey);

      const tagErrors: string[] = [];
      if (!existingId) {
        const created = await createContact(payload, systemeKey, contactsCache);
        if (created) {
          contactsCache.set(emailKey, created.id);
          // Si ya existía (isNew false), actualizar sus campos también
          if (!created.isNew) {
            await updateContact(created.id, payload, systemeKey);
          }
          await assignTagsToContact(created.id, desiredTags, tagsCache, systemeKey, tagErrors);
          if (created.isNew) result.created++;
          else result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        await updateContact(existingId, payload, systemeKey);
        await assignTagsToContact(existingId, desiredTags, tagsCache, systemeKey, tagErrors);
        result.updated++;
      }
      if (tagErrors.length > 0) {
        result.errors++;
        errors.push(`${contact.email} tags: ${tagErrors.join(" | ")}`);
      }
    } catch (err: unknown) {
      result.errors++;
      errors.push(`${contact.email}: ${err instanceof Error ? err.message : "Error"}`);
    }
  }

  if (errors.length > 0) result.errorDetail = errors.slice(0, 10).join("\n");
  return result;
}
