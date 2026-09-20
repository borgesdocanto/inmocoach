#!/usr/bin/env node

/**
 * systeme-sync-node.js
 * Sincronización Tokko → Systeme para el VPS
 * Ejecuta localmente sin depender de Vercel (sin timeout)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// ── Configuración ──────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GALAS_TEAM_ID = 'bb61ed0d-96dd-4c45-ac9a-c72169bd0b93';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan variables de entorno SUPABASE');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Tipos ──────────────────────────────────────────────────────────────────

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalizePhone(phone) {
  if (!phone) return "1111111111111";
  const clean = phone.replace(/[+\-\s]/g, "");
  return clean.startsWith("549") ? clean : "1111111111111";
}

function classifyStatus(status) {
  if (status === "Cerrado") return "Cerrado";
  if (status === "Perdidos") return "Perdido";
  return "Activo";
}

function splitName(fullName) {
  const parts = (fullName || "").trim().split(/\s+/);
  const first_name = parts.shift() ?? "";
  const surname = parts.join(" ") || "-";
  return { first_name, surname };
}

function normalizeTagName(s) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// ── HTTP ───────────────────────────────────────────────────────────────────

async function fetchWithRetry429(url, opts, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const r = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(timeout);
      if (r.status !== 429) return r;
      const wait = parseInt(r.headers.get("Retry-After") ?? "60") + 3;
      console.log(`⏳ Rate limit 429, esperando ${wait}s...`);
      await sleep(wait * 1000);
    } catch (err) {
      clearTimeout(timeout);
      if (i === retries - 1) throw err;
      await sleep(2000);
    }
  }
  throw new Error("429 persistente tras reintentos");
}

// ── Tokko ──────────────────────────────────────────────────────────────────

async function fetchTokkoContactsToday(tokkoKey, options = {}) {
  const fromDate = options.fromDate ?? (() => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    return threeDaysAgo.toISOString().split("T")[0];
  })();
  const base = "https://tokkobroker.com";
  const contacts = [];
  const seen = new Set();

  async function paginate(startUrl) {
    let currentUrl = startUrl;
    while (currentUrl) {
      const r = await fetch(currentUrl, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`Tokko error ${r.status}`);
      const data = await r.json();
      for (const c of (data.objects ?? [])) {
        if (c.email && !seen.has(c.email.toLowerCase())) {
          seen.add(c.email.toLowerCase());
          contacts.push(c);
        }
      }
      const next = data.meta?.next;
      currentUrl = next ? `${base}${next}` : null;
    }
  }

  const toFilter = options.toDate ? `&deleted_at__lt=${options.toDate}` : "";
  const toFilterCreated = options.toDate ? `&created_at__lt=${options.toDate}` : "";

  console.log(`📡 Trayendo contactos Tokko desde ${fromDate}${options.toDate ? ` hasta ${options.toDate}` : ''}...`);
  await paginate(`${base}/api/v1/contact/?key=${tokkoKey}&deleted_at__gt=${fromDate}${toFilter}&format=json`);
  await paginate(`${base}/api/v1/contact/?key=${tokkoKey}&created_at__gt=${fromDate}${toFilterCreated}&format=json`);
  console.log(`✓ Obtenidos ${contacts.length} contactos de Tokko`);
  return contacts;
}

// ── Systeme Tags ───────────────────────────────────────────────────────────

async function fetchAllSystemeTags(key) {
  const allTags = [];
  let lastId = null;
  console.log('📋 Cargando tags Systeme...');
  while (true) {
    const url = lastId
      ? `https://api.systeme.io/api/tags?limit=100&startingAfter=${lastId}`
      : "https://api.systeme.io/api/tags?limit=100";
    const r = await fetchWithRetry429(url, {
      headers: { "X-API-Key": key, accept: "application/json" },
    });
    if (!r.ok) throw new Error(`Systeme GET /api/tags → ${r.status}`);
    const d = await r.json();
    const items = d.items ?? [];
    allTags.push(...items);
    if (items.length < 100) break;
    lastId = items[items.length - 1].id;
  }
  console.log(`✓ ${allTags.length} tags en Systeme`);
  return allTags;
}

async function getOrCreateTag(name, tagsCache, key) {
  const exact = tagsCache.find(t => t.name === name);
  if (exact) return exact.id;
  
  const normName = normalizeTagName(name);
  const fuzzy = tagsCache.find(t => normalizeTagName(t.name) === normName);
  if (fuzzy) return fuzzy.id;
  
  const r = await fetchWithRetry429("https://api.systeme.io/api/tags", {
    method: "POST",
    headers: { "X-API-Key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ name }),
  });
  if (r.status === 201) {
    const d = await r.json();
    tagsCache.push({ id: d.id, name });
    return d.id;
  }
  if (r.status === 422) {
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

async function assignTagsToContact(contactId, tagNames, tagsCache, key, tagErrors = []) {
  const uniqueNames = Array.from(new Set(tagNames));
  for (const name of uniqueNames) {
    try {
      const tagId = await getOrCreateTag(name, tagsCache, key);
      if (!tagId) {
        tagErrors.push(`Tag "${name}": getOrCreateTag devolvió null`);
        continue;
      }
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
        if (r.status === 404) {
          tagErrors.push(`Contacto no existe en Systeme (ID ${contactId}).`);
        } else {
          const body = await r.text().catch(() => "");
          tagErrors.push(`Assign "${name}" → ${r.status}: ${body.slice(0, 100)}`);
        }
        break;
      }
    } catch (tagErr) {
      tagErrors.push(`Tag "${name}" excepción: ${tagErr.message}`);
    }
  }
}

// ── Systeme Contacts ───────────────────────────────────────────────────────

async function loadContactsCacheFromSupabase(teamId) {
  const cache = new Map();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("systeme_contact_cache")
      .select("email, systeme_id")
      .eq("team_id", teamId)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Supabase cache error: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      cache.set(row.email.toLowerCase(), row.systeme_id);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return cache;
}

async function loadContactsCacheFromSysteme(key) {
  const cache = new Map();
  let startingAfter = null;
  let hasMore = true;
  console.log('📡 Cargando cache completo de Systeme (esto tarda ~60s)...');
  while (hasMore) {
    const url = startingAfter
      ? `https://api.systeme.io/api/contacts?limit=100&startingAfter=${startingAfter}`
      : "https://api.systeme.io/api/contacts?limit=100";
    const r = await fetchWithRetry429(url, {
      headers: { "X-API-Key": key, accept: "application/json" },
    });
    if (!r.ok) throw new Error(`Systeme GET /api/contacts → ${r.status}`);
    const d = await r.json();
    const items = d.items ?? [];
    for (const item of items) {
      if (item.email) cache.set(item.email.toLowerCase(), item.id);
    }
    hasMore = d.hasMore === true && items.length > 0;
    if (hasMore) startingAfter = items[items.length - 1].id;
  }
  console.log(`✓ Cache de Systeme: ${cache.size} contactos`);
  return cache;
}

const INVALID_EMAIL_MSGS = ["no es válida", "not a valid email", "invalid email", "carece de un"];

async function createContact(payload, key, contactsCache) {
  const r = await fetchWithRetry429("https://api.systeme.io/api/contacts", {
    method: "POST",
    headers: { "X-API-Key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (r.status === 201) {
    const d = await r.json();
    return { id: d.id, isNew: true };
  }
  const errBody = await r.text().catch(() => "");
  if (r.status === 422 && INVALID_EMAIL_MSGS.some(m => errBody.includes(m))) return null;
  if (r.status === 422 && (errBody.includes("ya se ha utilizado") || errBody.includes("already been used"))) {
    const email = payload.email.toLowerCase();
    const refreshed = await loadContactsCacheFromSysteme(key);
    refreshed.forEach((v, k) => contactsCache.set(k, v));
    const existingId = contactsCache.get(email);
    if (existingId) return { id: existingId, isNew: false };
    return null;
  }
  throw new Error(`POST /api/contacts → ${r.status}: ${errBody.slice(0, 200)}`);
}

async function updateContact(id, payload, key) {
  const r = await fetchWithRetry429(`https://api.systeme.io/api/contacts/${id}`, {
    method: "PATCH",
    headers: { "X-API-Key": key, "content-type": "application/merge-patch+json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: r.ok, notFound: r.status === 404 };
}

// ── Función principal ──────────────────────────────────────────────────────

async function runSync(params) {
  const { tokkoKey, systemeKey, whitelistTags, fixedTags, teamId, dateRange } = params;
  const result = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const errors = [];
  const startTime = Date.now();

  try {
    // 1. Obtener contactos de Tokko
    const contacts = await fetchTokkoContactsToday(tokkoKey, {
      fromDate: dateRange?.fromDate,
      toDate: dateRange?.toDate,
    });

    if (contacts.length === 0) {
      console.log('⚠️ Sin contactos para sincronizar');
      return result;
    }

    // 2. Cargar caches
    console.log('📦 Cargando cache de Supabase...');
    const contactsCache = await loadContactsCacheFromSupabase(teamId);
    console.log(`✓ Cache Supabase: ${contactsCache.size} contactos`);

    const tagsCache = await fetchAllSystemeTags(systemeKey);

    // 3. Procesar contactos
    console.log(`🔄 Procesando ${contacts.length} contactos...`);
    for (let i = 0; i < contacts.length; i++) {
      if (i % 50 === 0) console.log(`  → ${i}/${contacts.length}`);
      const contact = contacts[i];
      try {
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
        const fields = [
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

        if (existingId) {
          const upd = await updateContact(existingId, payload, systemeKey);
          if (!upd.notFound) {
            const tagErrors = [];
            await assignTagsToContact(existingId, desiredTags, tagsCache, systemeKey, tagErrors);
            result.updated++;
            if (tagErrors.length > 0) {
              result.errors++;
              errors.push(`${contact.email} tags: ${tagErrors.join(" | ")}`);
            }
            continue;
          }
          contactsCache.delete(emailKey);
          existingId = undefined;
        }

        const created = await createContact(payload, systemeKey, contactsCache);
        if (!created) {
          result.skipped++;
          continue;
        }

        contactsCache.set(emailKey, created.id);
        const tagErrors = [];
        if (!created.isNew) {
          await updateContact(created.id, payload, systemeKey);
        } else {
          await sleep(800);
        }
        await assignTagsToContact(created.id, desiredTags, tagsCache, systemeKey, tagErrors);
        result[created.isNew ? 'created' : 'updated']++;
        if (tagErrors.length > 0) {
          result.errors++;
          errors.push(`${contact.email} tags: ${tagErrors.join(" | ")}`);
        }
      } catch (err) {
        result.errors++;
        errors.push(`${contact.email}: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      result.errorDetail = errors.slice(0, 10).join("\n");
    }
  } catch (err) {
    console.error(`❌ Sync fatal error: ${err.message}`);
    result.errorDetail = err.message;
    throw err;
  }

  const totalElapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`✓ FIN — ${totalElapsed}s — created: ${result.created}, updated: ${result.updated}, skipped: ${result.skipped}, errors: ${result.errors}`);
  return result;
}

// ── Punto de entrada ───────────────────────────────────────────────────────

async function main() {
  console.log('🔄 CRON 2 — Sync histórico Tokko→Systeme');
  console.log(`📅 Iniciado: ${new Date().toISOString()}`);

  try {
    // Obtener configuración de sync
    const { data: syncConfig, error: syncError } = await supabase
      .from('sync_configs')
      .select('systeme_api_key, is_active, is_configured')
      .eq('team_id', GALAS_TEAM_ID)
      .single();

    if (syncError || !syncConfig) {
      throw new Error(`Sync config no encontrado: ${syncError?.message}`);
    }

    if (!syncConfig.is_active || !syncConfig.is_configured) {
      throw new Error('Sync no activa o no configurada');
    }

    // Obtener API key de Tokko desde teams
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('tokko_api_key')
      .eq('id', GALAS_TEAM_ID)
      .single();

    if (teamError || !teamData?.tokko_api_key) {
      throw new Error(`API key Tokko no encontrado: ${teamError?.message}`);
    }

    // Obtener tags
    const { data: whitelist } = await supabase
      .from('sync_tags_whitelist')
      .select('tag_name')
      .eq('team_id', GALAS_TEAM_ID);

    const { data: fixed } = await supabase
      .from('sync_tags_fixed')
      .select('tag_name')
      .eq('team_id', GALAS_TEAM_ID);

    const tokkoKey = teamData.tokko_api_key;
    const systemeKey = syncConfig.systeme_api_key;
    const whitelistTags = (whitelist || []).map(r => r.tag_name);
    const fixedTags = (fixed || []).map(r => r.tag_name);

    if (!tokkoKey || !systemeKey) {
      throw new Error('Faltan API keys en la configuración del team');
    }

    // Obtener fecha más antigua sincronizada
    const { data: cacheData } = await supabase
      .from('systeme_contact_cache')
      .select('tokko_deleted_at')
      .eq('team_id', GALAS_TEAM_ID)
      .order('tokko_deleted_at', { ascending: true })
      .limit(1);

    const oldestDate = cacheData?.[0]?.tokko_deleted_at;
    if (!oldestDate) {
      console.log('⚠️ Sin fecha para sync histórico (cache vacío)');
      return;
    }

    // Calcular rango: 7 días hacia atrás desde oldestDate
    const oldest = new Date(oldestDate);
    const fromDate = new Date(oldest.getTime() - 7 * 24 * 60 * 60 * 1000);
    const toDate = new Date(oldest);

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    console.log(`📅 Rango: ${fromStr} a ${toStr}`);

    // Crear log en Supabase
    const { data: logData, error: logError } = await supabase
      .from('sync_logs')
      .insert({
        team_id: GALAS_TEAM_ID,
        started_at: new Date().toISOString(),
        status: 'running',
        cron_mode: 'historic',
        trigger: 'vps-cron',
        from_date: fromStr,
        to_date: toStr,
      })
      .select('id')
      .single();

    if (logError) throw logError;
    const logId = logData.id;
    console.log(`📝 Log creado: ${logId}`);

    // Ejecutar sync — NO usar whitelist en modo historic
    const result = await runSync({
      tokkoKey,
      systemeKey,
      whitelistTags: [], // CRON 2 no usa whitelist
      fixedTags,
      teamId: GALAS_TEAM_ID,
      dateRange: { fromDate: fromStr, toDate: toStr },
    });

    // Actualizar log
    const { error: updateError } = await supabase
      .from('sync_logs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'success',
        contacts_created: result.created,
        contacts_updated: result.updated,
        contacts_skipped: result.skipped,
        errors_count: result.errors,
        error_detail: result.errorDetail,
      })
      .eq('id', logId);

    if (updateError) throw updateError;
    console.log(`✅ Sync completado y registrado en BD`);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`❌ Fatal: ${err.message}`);
  process.exit(1);
});
