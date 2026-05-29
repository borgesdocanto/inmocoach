#!/usr/bin/env python3
"""
backfill_local.py — Sincronización histórica Tokko → Systeme
Correr desde la máquina local (no desde Vercel) para evitar el bloqueo 403 de Tokko.

Uso:
  pip install requests
  python backfill_local.py

Configurar las variables de entorno o editar directamente las constantes abajo.
"""

import requests
import time
from datetime import datetime, timedelta

# ── Configuración ──────────────────────────────────────────────────────────
TOKKO_KEY     = "44b438c60bbde9a6e02e62afda4ef2e86f15aa1d"
SYSTEME_KEY   = "1sy7h87ynf9y4ez8evr7r86iqkhhtlisvcr3ny3ccnrhlonggcpka9ebcuo7dbxy"

# Tags de Tokko a sincronizar (whitelist)
WHITELIST_TAGS = [
    "8x8 Propietario", "8x8 PROPIETARIO", "Dueño vende",
    "Alquiler", "Venta", "Interesado Alquilo En Galas",
    "Interesado Compro En Galas", "Interesado Alquilo Con Otro",
]

# Tags que se agregan siempre
FIXED_TAGS = ["galas"]

# Rango de fechas a procesar
DAYS_BACK = 30
# ──────────────────────────────────────────────────────────────────────────

INVALID_EMAIL_MSGS = ["no es válida", "not a valid email", "invalid email", "carece de un"]


def split_name(full_name):
    parts = (full_name or "").strip().split()
    first = parts.pop(0) if parts else ""
    surname = " ".join(parts) if parts else "-"
    return first, surname


def normalize_phone(phone):
    if not phone:
        return "1111111111111"
    clean = phone.replace("+", "").replace("-", "").replace(" ", "")
    return clean if clean.startswith("549") else "1111111111111"


def classify_status(status):
    if status == "Cerrado":
        return "Cerrado"
    if status == "Perdidos":
        return "Perdido"
    return "Activo"


def fetch_with_retry(method, url, **kwargs):
    for attempt in range(3):
        try:
            r = requests.request(method, url, timeout=15, **kwargs)
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", 60)) + 3
                print(f"  429 — esperando {wait}s...")
                time.sleep(wait)
                continue
            return r
        except requests.exceptions.RequestException as e:
            if attempt == 2:
                raise
            time.sleep(5)
    return None


# ── Cargar cache de Systeme ────────────────────────────────────────────────
def load_systeme_cache():
    print("Cargando contactos de Systeme...")
    cache = {}  # email.lower() → id
    starting_after = None
    has_more = True

    while has_more:
        url = "https://api.systeme.io/api/contacts?limit=100"
        if starting_after:
            url += f"&startingAfter={starting_after}"
        r = fetch_with_retry("GET", url, headers={"X-API-Key": SYSTEME_KEY, "accept": "application/json"})
        if not r or not r.ok:
            print(f"  Error cargando cache: {r.status_code if r else 'timeout'}")
            break
        d = r.json()
        items = d.get("items", [])
        for item in items:
            if item.get("email"):
                cache[item["email"].lower()] = item["id"]
        has_more = d.get("hasMore", False) and len(items) > 0
        if has_more:
            starting_after = items[-1]["id"]

    print(f"  {len(cache)} contactos en Systeme")
    return cache


# ── Cargar tags de Systeme ─────────────────────────────────────────────────
def load_systeme_tags():
    r = fetch_with_retry("GET", "https://api.systeme.io/api/tags?limit=100",
                         headers={"X-API-Key": SYSTEME_KEY, "accept": "application/json"})
    return r.json().get("items", []) if r and r.ok else []


def get_or_create_tag(name, tags_list):
    found = next((t for t in tags_list if t["name"] == name), None)
    if found:
        return found["id"]
    r = fetch_with_retry("POST", "https://api.systeme.io/api/tags",
                         headers={"X-API-Key": SYSTEME_KEY, "content-type": "application/json"},
                         json={"name": name})
    if r and r.ok:
        d = r.json()
        tags_list.append({"id": d["id"], "name": name})
        return d["id"]
    return None


def assign_tag(contact_id, tag_id):
    fetch_with_retry("POST", f"https://api.systeme.io/api/contacts/{contact_id}/tags",
                     headers={"X-API-Key": SYSTEME_KEY, "content-type": "application/json"},
                     json={"tagId": tag_id})


# ── Traer contactos de Tokko para una fecha ────────────────────────────────
def fetch_tokko_contacts(date_str):
    base = "https://tokkobroker.com"
    contacts = []
    seen = set()

    for field in ["deleted_at__gt", "created_at__gt"]:
        url = f"{base}/api/v1/contact/?key={TOKKO_KEY}&{field}={date_str}&format=json&limit=100"
        while url:
            r = fetch_with_retry("GET", url)
            if not r or not r.ok:
                print(f"  Tokko error: {r.status_code if r else 'timeout'}")
                break
            d = r.json()
            for c in d.get("objects", []):
                email = c.get("email", "").strip()
                if email and email.lower() not in seen:
                    seen.add(email.lower())
                    contacts.append(c)
            nxt = d.get("meta", {}).get("next")
            url = f"{base}{nxt}" if nxt else None

    return contacts


# ── Procesar un contacto ───────────────────────────────────────────────────
def process_contact(contact, cache, tags_list):
    email = contact.get("email", "").strip()
    if not email:
        return "skipped"

    first_name, surname = split_name(contact.get("name", ""))
    phone = normalize_phone(contact.get("cellphone"))
    status = classify_status(contact.get("lead_status"))
    agent_name = (contact.get("agent") or {}).get("name", "")
    agent_email = (contact.get("agent") or {}).get("email", "")

    tokko_tags = [t["name"] for t in (contact.get("tags") or [])]
    filtered = [t for t in tokko_tags if t in WHITELIST_TAGS] if WHITELIST_TAGS else tokko_tags
    desired_tags = list(set(FIXED_TAGS + filtered + (["is_owner"] if contact.get("is_owner") else []) + [status]))

    fields = [
        {"slug": "surname", "value": surname},
        {"slug": "status", "value": status},
        {"slug": "phone_number", "value": phone},
    ]
    if agent_name:
        fields.append({"slug": "agent_name", "value": agent_name})
    if agent_email:
        fields.append({"slug": "agent_email", "value": agent_email})

    payload = {"email": email, "firstName": first_name, "locale": "es", "fields": fields}
    email_key = email.lower()
    existing_id = cache.get(email_key)

    if not existing_id:
        r = fetch_with_retry("POST", "https://api.systeme.io/api/contacts",
                             headers={"X-API-Key": SYSTEME_KEY, "content-type": "application/json", "accept": "application/json"},
                             json=payload)
        if r and r.status_code == 201:
            d = r.json()
            cache[email_key] = d["id"]
            existing_id = d["id"]
            action = "created"
        elif r and r.status_code == 422:
            body = r.text
            if any(m in body for m in INVALID_EMAIL_MSGS):
                return "skipped"
            return "error"
        else:
            return "error"
    else:
        fetch_with_retry("PATCH", f"https://api.systeme.io/api/contacts/{existing_id}",
                         headers={"X-API-Key": SYSTEME_KEY, "content-type": "application/merge-patch+json", "accept": "application/json"},
                         json=payload)
        action = "updated"

    # Asignar tags
    for tag_name in desired_tags:
        tag_id = get_or_create_tag(tag_name, tags_list)
        if tag_id:
            assign_tag(existing_id, tag_id)

    return action


# ── Main ───────────────────────────────────────────────────────────────────
def main():
    print("=== Backfill Tokko → Systeme ===")
    print(f"Procesando últimos {DAYS_BACK} días\n")

    cache = load_systeme_cache()
    print("Cargando tags de Systeme...")
    tags_list = load_systeme_tags()
    print(f"  {len(tags_list)} tags en Systeme")

    # Pre-crear tags fijas
    print("Pre-creando tags fijas...")
    for tag in FIXED_TAGS:
        get_or_create_tag(tag, tags_list)
    print("  Listo")

    total = {"created": 0, "updated": 0, "skipped": 0, "errors": 0}

    for day in range(DAYS_BACK - 1, -1, -1):
        date = (datetime.now() - timedelta(days=day)).strftime("%Y-%m-%d")
        print(f"  Procesando {date}...", end="", flush=True)
        contacts = fetch_tokko_contacts(date)

        if not contacts:
            print(f"  {date} — 0 contactos")
            continue

        day_stats = {"created": 0, "updated": 0, "skipped": 0, "errors": 0}
        for c in contacts:
            result = process_contact(c, cache, tags_list)
            day_stats[result] = day_stats.get(result, 0) + 1
            total[result] = total.get(result, 0) + 1

        print(f"  {date} — {len(contacts)} contactos | +{day_stats['created']} creados | ↻{day_stats['updated']} actualizados | {day_stats['skipped']} skip | ⚠{day_stats['errors']} errores")
        time.sleep(1)

    print(f"\n=== Totales ===")
    print(f"Creados:      {total['created']}")
    print(f"Actualizados: {total['updated']}")
    print(f"Salteados:    {total['skipped']}")
    print(f"Errores:      {total['errors']}")


if __name__ == "__main__":
    main()
