// POST /api/admin/systeme-backfill
// Sincroniza contactos de Tokko para una fecha específica usando el cache en Supabase
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabase";
import { isSuperAdmin } from "../../../lib/adminGuard";

interface TokkoContact {
  id: number;
  email: string;
  name: string;
  cellphone?: string;
  tags?: { name: string }[];
  agent?: { name?: string; email?: string } | null;
  lead_status?: string;
  is_owner?: boolean;
}

function splitName(fullName: string) {
  const parts = (fullName || "").trim().split(/\s+/);
  return { first_name: parts.shift() ?? "", surname: parts.join(" ") || "-" };
}

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

async function fetchWithRetry(url: string, opts: RequestInit): Promise<Response> {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) });
    if (r.status !== 429) return r;
    const wait = parseInt(r.headers.get("Retry-After") ?? "30");
    await new Promise(res => setTimeout(res, wait * 1000));
  }
  throw new Error("429 persistente");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user?.email)) return res.status(403).end();

  const { date, teamId: bodyTeamId } = req.body as { date: string; teamId?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date requerido (YYYY-MM-DD)" });
  }

  const teamId = bodyTeamId || "bb61ed0d-96dd-4c45-ac9a-c72169bd0b93";

  const [syncConfigRes, teamRes, whitelistRes, fixedRes] = await Promise.all([
    supabaseAdmin.from("sync_configs").select("systeme_api_key").eq("team_id", teamId).single(),
    supabaseAdmin.from("teams").select("tokko_api_key").eq("id", teamId).single(),
    supabaseAdmin.from("sync_tags_whitelist").select("tag_name").eq("team_id", teamId),
    supabaseAdmin.from("sync_tags_fixed").select("tag_name").eq("team_id", teamId),
  ]);

  const systemeKey = syncConfigRes.data?.systeme_api_key;
  const tokkoKey = teamRes.data?.tokko_api_key;
  if (!systemeKey || !tokkoKey) return res.status(400).json({ error: "Sin config" });

  const whitelistTags = (whitelistRes.data || []).map(r => r.tag_name);
  const fixedTags = (fixedRes.data || []).map(r => r.tag_name);

  // 1. Traer contactos de Tokko para esta fecha
  const base = "https://tokkobroker.com";
  const contacts: TokkoContact[] = [];
  const seen = new Set<string>();

  async function paginate(startUrl: string) {
    let url: string | null = startUrl;
    while (url) {
      const fetchUrl: string = url;
      const r: Response = await fetch(fetchUrl, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`Tokko ${r.status}`);
      const data = await r.json();
      for (const c of (data.objects ?? []) as TokkoContact[]) {
        if (c.email && !seen.has(c.email.toLowerCase())) {
          seen.add(c.email.toLowerCase());
          contacts.push(c);
        }
      }
      const next: string | undefined = data.meta?.next;
      url = next ? `${base}${next}` : null;
    }
  }

  await paginate(`${base}/api/v1/contact/?key=${tokkoKey}&deleted_at__gt=${date}&format=json&limit=100`);
  await paginate(`${base}/api/v1/contact/?key=${tokkoKey}&created_at__gt=${date}&format=json&limit=100`);

  if (contacts.length === 0) return res.json({ date, contacts: 0, created: 0, updated: 0, skipped: 0, errors: 0 });

  // 2. Leer cache de Supabase para estos emails
  const emails = contacts.map(c => c.email.toLowerCase());
  const { data: cacheRows } = await supabaseAdmin
    .from("systeme_contact_cache")
    .select("email, systeme_id")
    .eq("team_id", teamId)
    .in("email", emails);

  const cacheMap = new Map<string, number>();
  for (const row of (cacheRows || [])) cacheMap.set(row.email, row.systeme_id);

  // 3. Cargar tags de Systeme (rápido — solo las existentes)
  const tagsR = await fetch("https://api.systeme.io/api/tags?limit=100", {
    headers: { "X-API-Key": systemeKey, accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  const tagsData = tagsR.ok ? await tagsR.json() : { items: [] };
  const systemeTags: { id: number; name: string }[] = tagsData.items ?? [];

  // Pre-crear tags fijas
  for (const tagName of fixedTags) {
    if (!systemeTags.find(t => t.name === tagName)) {
      const tr = await fetchWithRetry("https://api.systeme.io/api/tags", {
        method: "POST",
        headers: { "X-API-Key": systemeKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ name: tagName }),
      });
      if (tr.ok) { const td = await tr.json(); systemeTags.push({ id: td.id, name: tagName }); }
    }
  }

  const INVALID_EMAIL_MSGS = ["no es válida", "not a valid email", "invalid email", "carece de un"];
  let created = 0, updated = 0, skipped = 0, errors = 0;
  const errorDetails: string[] = [];

  // 4. Procesar cada contacto
  for (const contact of contacts) {
    if (!contact.email?.trim()) { skipped++; continue; }

    try {
      const { first_name, surname } = splitName(contact.name);
      const phone = normalizePhone(contact.cellphone);
      const status = classifyStatus(contact.lead_status);
      const agentName = contact.agent?.name ?? "";
      const agentEmail = contact.agent?.email ?? "";

      const tokkoTagNames = (contact.tags ?? []).map(t => t.name);
      const filteredTags = whitelistTags.length > 0
        ? tokkoTagNames.filter(n => whitelistTags.includes(n))
        : tokkoTagNames;

      const allDesiredTags = Array.from(new Set([
        ...fixedTags, ...filteredTags,
        ...(contact.is_owner ? ["is_owner"] : []),
        status,
      ]));

      const fields = [
        { slug: "surname", value: surname },
        { slug: "status", value: status },
        { slug: "phone_number", value: phone || "1111111111111" },
        ...(agentName ? [{ slug: "agent_name", value: agentName }] : []),
        ...(agentEmail ? [{ slug: "agent_email", value: agentEmail }] : []),
      ].filter(f => f.value.trim() !== "");

      const payload = { email: contact.email.trim(), firstName: first_name, locale: "es", fields };
      const emailKey = contact.email.trim().toLowerCase();
      const existingId = cacheMap.get(emailKey);

      if (!existingId) {
        // Crear
        const r = await fetchWithRetry("https://api.systeme.io/api/contacts", {
          method: "POST",
          headers: { "X-API-Key": systemeKey, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.status === 201) {
          const d = await r.json();
          cacheMap.set(emailKey, d.id);
          // Agregar al cache de Supabase
          await supabaseAdmin.from("systeme_contact_cache")
            .upsert({ team_id: teamId, email: emailKey, systeme_id: d.id }, { onConflict: "team_id,email" });
          // Asignar tags
          for (const tagName of allDesiredTags) {
            let tagId = systemeTags.find(t => t.name === tagName)?.id;
            if (!tagId) {
              const tr = await fetchWithRetry("https://api.systeme.io/api/tags", {
                method: "POST",
                headers: { "X-API-Key": systemeKey, "content-type": "application/json" },
                body: JSON.stringify({ name: tagName }),
              });
              if (tr.ok) { const td = await tr.json(); tagId = td.id; systemeTags.push({ id: td.id, name: tagName }); }
            }
            if (tagId) {
              await fetchWithRetry(`https://api.systeme.io/api/contacts/${d.id}/tags`, {
                method: "POST",
                headers: { "X-API-Key": systemeKey, "content-type": "application/json" },
                body: JSON.stringify({ tagId }),
              });
            }
          }
          created++;
        } else {
          const errBody = await r.text().catch(() => "");
          if (r.status === 422 && INVALID_EMAIL_MSGS.some(m => errBody.includes(m))) { skipped++; continue; }
          errorDetails.push(`${contact.email}: POST ${r.status}`);
          errors++;
        }
      } else {
        // Actualizar
        await fetchWithRetry(`https://api.systeme.io/api/contacts/${existingId}`, {
          method: "PATCH",
          headers: { "X-API-Key": systemeKey, "content-type": "application/merge-patch+json", accept: "application/json" },
          body: JSON.stringify(payload),
        });
        // Asignar tags fijas y deseadas
        for (const tagName of allDesiredTags) {
          let tagId = systemeTags.find(t => t.name === tagName)?.id;
          if (!tagId) {
            const tr = await fetchWithRetry("https://api.systeme.io/api/tags", {
              method: "POST",
              headers: { "X-API-Key": systemeKey, "content-type": "application/json" },
              body: JSON.stringify({ name: tagName }),
            });
            if (tr.ok) { const td = await tr.json(); tagId = td.id; systemeTags.push({ id: td.id, name: tagName }); }
          }
          if (tagId) {
            await fetchWithRetry(`https://api.systeme.io/api/contacts/${existingId}/tags`, {
              method: "POST",
              headers: { "X-API-Key": systemeKey, "content-type": "application/json" },
              body: JSON.stringify({ tagId }),
            });
          }
        }
        updated++;
      }
    } catch (err: unknown) {
      errors++;
      errorDetails.push(`${contact.email}: ${err instanceof Error ? err.message : "Error"}`);
    }
  }

  return res.json({
    date, contacts: contacts.length, created, updated, skipped, errors,
    errorDetail: errorDetails.slice(0, 5).join("\n") || null,
  });
}
