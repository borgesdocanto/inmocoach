/**
 * lib/systemeSync.ts
 * Motor de sincronización Tokko → Systeme.io
 */

import { supabaseAdmin } from "./supabase";

export interface TokkoContact {
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

// Carga el cache de Systeme paginando la API completa (lento — solo para refresh inicial)
async function loadContactsCacheFromSysteme(key: string): Promise<Map<string, number>> {
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

// Carga el cache desde Supabase (rápido — ~1 segundo vs ~70s de paginar Systeme)
async function loadContactsCacheFromSupabase(teamId: string): Promise<Map<string, number>> {
  const cache = new Map<string, number>();
  // Paginar de Supabase (límite 1000 por query)
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("systeme_contact_cache")
      .select("email, systeme_id")
      .eq("team_id", teamId)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Supabase cache error: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      cache.set((row.email as string).toLowerCase(), row.systeme_id as number);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return cache;
}

// Persistir nuevos contactos creados en el cache de Supabase
async function persistNewContactToCache(teamId: string, email: string, systemeId: number): Promise<void> {
  try {
    await supabaseAdmin
      .from("systeme_contact_cache")
      .upsert({ team_id: teamId, email: email.toLowerCase(), systeme_id: systemeId }, { onConflict: "team_id,email" });
  } catch { /* no bloquear el sync por un fallo de cache */ }
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
  // Email ya usado → el contacto existe pero no estaba en el cache — recargar TODO Systeme
  // Caso poco frecuente (solo si el cache de Supabase está desactualizado para este email)
  // El mensaje puede venir en español ("ya se ha utilizado") o inglés ("has already been used")
  if (r.status === 422 && (errBody.includes("ya se ha utilizado") || errBody.includes("already been used") || errBody.includes("already used"))) {
    const email = (payload.email as string).toLowerCase();
    const refreshed = await loadContactsCacheFromSysteme(key);
    refreshed.forEach((v, k) => contactsCache.set(k, v));
    const existingId = contactsCache.get(email);
    if (existingId) return { id: existingId, isNew: false };
    return null;
  }
  throw new Error(`POST /api/contacts → ${r.status}: ${errBody.slice(0, 200)}`);
}

async function updateContact(id: number, payload: Record<string, unknown>, key: string): Promise<{ ok: boolean; notFound: boolean }> {
  const r = await fetchWithRetry429(`https://api.systeme.io/api/contacts/${id}`, {
    method: "PATCH",
    headers: { "X-API-Key": key, "content-type": "application/merge-patch+json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: r.ok, notFound: r.status === 404 };
}

// ── Función principal ──────────────────────────────────────────────────────

export async function runSync(params: {
  tokkoKey: string;
  systemeKey: string;
  whitelistTags: string[];
  fixedTags: string[];
  overrideContacts?: TokkoContact[];
  teamId?: string;
}): Promise<SyncResult> {
  const { tokkoKey, systemeKey, whitelistTags, fixedTags, overrideContacts, teamId } = params;
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

  // 4. Cache de contactos existentes — desde Supabase si tenemos teamId (rápido), sino desde Systeme paginado
  const contactsCache = teamId
    ? await loadContactsCacheFromSupabase(teamId)
    : await loadContactsCacheFromSysteme(systemeKey);

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

      // Slugs nativos de Systeme (confirmado en doc PHP oficial):
      // "first_name" → Nombre | "surname" → Apellido | "phone_number" → Teléfono
      // Systeme rechaza valores vacíos en estos campos — solo incluir si tienen valor
      const surnameClean = surname === "-" ? "" : surname;
      const fields: { slug: string; value: string }[] = [
        ...(first_name ? [{ slug: "first_name", value: first_name }] : []),
        ...(surnameClean ? [{ slug: "surname", value: surnameClean }] : []),
        { slug: "phone_number", value: phone },
        { slug: "status", value: status },
        ...(agentName ? [{ slug: "agent_name", value: agentName }] : []),
        ...(agentEmail ? [{ slug: "agent_email", value: agentEmail }] : []),
      ];

      const payload = {
        email: contact.email.trim(),
        locale: "es",
        fields,
      };
      const emailKey = contact.email.trim().toLowerCase();
      let existingId = contactsCache.get(emailKey);

      const tagErrors: string[] = [];

      // Si tenemos ID en cache, intentar update primero
      if (existingId) {
        const upd = await updateContact(existingId, payload, systemeKey);
        if (upd.notFound) {
          // Cache stale: el contacto fue borrado en Systeme (probablemente por inactividad).
          // Limpiamos cache y caemos al flujo de creación en esta misma corrida.
          contactsCache.delete(emailKey);
          if (teamId) {
            try {
              await supabaseAdmin
                .from("systeme_contact_cache").delete()
                .eq("team_id", teamId).eq("email", emailKey);
            } catch { /* ignorar */ }
          }
          existingId = undefined; // forzar flujo de creación
        } else {
          // Update OK — asignar tags
          await assignTagsToContact(existingId, desiredTags, tagsCache, systemeKey, tagErrors);
          result.updated++;
        }
      }

      // Flujo de creación (cache miss o cache stale recién limpiado)
      if (!existingId) {
        const created = await createContact(payload, systemeKey, contactsCache);
        if (created) {
          contactsCache.set(emailKey, created.id);
          if (teamId) await persistNewContactToCache(teamId, emailKey, created.id);
          // Si Systeme lo encontró por email (isNew=false), actualizar campos
          if (!created.isNew) {
            await updateContact(created.id, payload, systemeKey);
          } else {
            // Recién creado: esperar para que Systeme lo indexe
            await sleep(800);
          }
          await assignTagsToContact(created.id, desiredTags, tagsCache, systemeKey, tagErrors);
          if (created.isNew) result.created++;
          else result.updated++;
        } else {
          result.skipped++;
        }
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


// Procesa UN contacto individualmente — extraído para usar en el flujo por chunks.
// Retorna {action: created|updated|skipped, tagErrors[]}
export async function processSingleContact(params: {
  contact: TokkoContact;
  systemeKey: string;
  whitelistTags: string[];
  fixedTags: string[];
  contactsCache: Map<string, number>;
  tagsCache: { id: number; name: string }[];
  teamId?: string;
}): Promise<{ action: "created" | "updated" | "skipped"; tagErrors: string[] }> {
  const { contact, systemeKey, whitelistTags, fixedTags, contactsCache, tagsCache, teamId } = params;
  const tagErrors: string[] = [];

  if (!contact.email?.trim()) return { action: "skipped", tagErrors };

  const { first_name, surname } = splitName(contact.name ?? "");
  const status = classifyStatus(contact.lead_status);
  const phone = normalizePhone(contact.cellphone);
  const agentName = contact.agent?.name ?? "";
  const agentEmail = contact.agent?.email ?? "";

  const tokkoTagNames = (contact.tags ?? []).map(t => t.name);
  const whitelistNorm = whitelistTags.map(normalizeTagName);
  const filteredTokkoTags = whitelistTags.length > 0
    ? tokkoTagNames.filter(n => whitelistNorm.includes(normalizeTagName(n)))
    : tokkoTagNames;

  const desiredTags = Array.from(new Set([
    ...fixedTags,
    ...filteredTokkoTags,
    ...(contact.is_owner ? ["is_owner"] : []),
    status,
  ]));

  const surnameClean = surname === "-" ? "" : surname;
  const fields: { slug: string; value: string }[] = [
    ...(first_name ? [{ slug: "first_name", value: first_name }] : []),
    ...(surnameClean ? [{ slug: "surname", value: surnameClean }] : []),
    { slug: "phone_number", value: phone },
    { slug: "status", value: status },
    ...(agentName ? [{ slug: "agent_name", value: agentName }] : []),
    ...(agentEmail ? [{ slug: "agent_email", value: agentEmail }] : []),
  ];

  const payload = {
    email: contact.email.trim(),
    locale: "es",
    fields,
  };

  const emailKey = contact.email.trim().toLowerCase();
  let existingId = contactsCache.get(emailKey);

  // Si tenemos un ID en cache, intentar update primero
  if (existingId) {
    const upd = await updateContact(existingId, payload, systemeKey);
    if (upd.notFound) {
      // Cache stale: el contacto fue borrado en Systeme (probablemente por inactividad).
      // Limpiamos cache y caemos al flujo de creación en esta misma corrida.
      contactsCache.delete(emailKey);
      if (teamId) {
        try {
          await supabaseAdmin
            .from("systeme_contact_cache").delete()
            .eq("team_id", teamId).eq("email", emailKey);
        } catch { /* ignorar */ }
      }
      existingId = undefined; // forzar el flujo de creación abajo
    } else {
      // Update OK — asignar tags y terminar
      await assignTagsToContactWithRetry(
        existingId, desiredTags, tagsCache, systemeKey, tagErrors,
        teamId ? { teamId, email: emailKey } : undefined
      );
      return { action: "updated", tagErrors };
    }
  }

  // Flujo de creación (cache miss o cache stale recién limpiado)
  // createContact maneja internamente el 422 "email ya usado": recarga el cache
  // desde Systeme y devuelve el ID actual del contacto.
  const created = await createContact(payload, systemeKey, contactsCache);
  if (!created) {
    return { action: "skipped", tagErrors };
  }

  contactsCache.set(emailKey, created.id);
  if (teamId) {
    try {
      await supabaseAdmin
        .from("systeme_contact_cache")
        .upsert({ team_id: teamId, email: emailKey, systeme_id: created.id }, { onConflict: "team_id,email" });
    } catch { /* no bloquear */ }
  }

  // Si era cache miss pero Systeme lo encontró por email (isNew=false), actualizar campos también
  if (!created.isNew) {
    await updateContact(created.id, payload, systemeKey);
  } else {
    // Recién creado: pequeña espera para que Systeme lo indexe antes de asignar tags
    await sleep(800);
  }

  await assignTagsToContactWithRetry(
    created.id, desiredTags, tagsCache, systemeKey, tagErrors,
    teamId ? { teamId, email: emailKey } : undefined
  );

  return { action: created.isNew ? "created" : "updated", tagErrors };
}

// Versión con retry de assignTagsToContact — Systeme a veces devuelve 404 para contactos recién creados
async function assignTagsToContactWithRetry(
  contactId: number,
  tagNames: string[],
  tagsCache: { id: number; name: string }[],
  key: string,
  tagErrors: string[],
  cacheCleanup?: { teamId: string; email: string }
): Promise<void> {
  const uniqueNames = Array.from(new Set(tagNames));
  let contactDeletedFromSysteme = false;
  for (const name of uniqueNames) {
    if (contactDeletedFromSysteme) break; // No reintentar más tags si el contacto no existe
    try {
      const tagId = await getOrCreateTag(name, tagsCache, key);
      if (!tagId) {
        tagErrors.push(`Tag "${name}": getOrCreateTag devolvió null`);
        continue;
      }
      // Reintentar hasta 3 veces si recibe 404 (consistencia eventual de Systeme)
      let success = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await fetchWithRetry429(`https://api.systeme.io/api/contacts/${contactId}/tags`, {
          method: "POST",
          headers: { "X-API-Key": key, "content-type": "application/json" },
          body: JSON.stringify({ tagId }),
        });
        if (r.ok || r.status === 422) { success = true; break; }
        if (r.status === 404 && attempt < 2) {
          await sleep(1500 * (attempt + 1));
          continue;
        }
        const body = await r.text().catch(() => "");
        // 404 persistente: el contacto ya no existe en Systeme.
        // Borrar del cache de Supabase para que la próxima corrida lo recree.
        if (r.status === 404 && cacheCleanup) {
          try {
            await supabaseAdmin
              .from("systeme_contact_cache")
              .delete()
              .eq("team_id", cacheCleanup.teamId)
              .eq("email", cacheCleanup.email);
            tagErrors.push(`Contacto ${cacheCleanup.email} no existe en Systeme (ID ${contactId}). Cache limpiado, se recreará en próxima corrida.`);
            contactDeletedFromSysteme = true;
          } catch { /* ignorar */ }
        } else {
          tagErrors.push(`Assign "${name}" → ${r.status}: ${body.slice(0, 80)}`);
        }
        break;
      }
      if (!success) continue;
    } catch (tagErr: unknown) {
      tagErrors.push(`Tag "${name}" excepción: ${tagErr instanceof Error ? tagErr.message : "Error"}`);
    }
  }
}
