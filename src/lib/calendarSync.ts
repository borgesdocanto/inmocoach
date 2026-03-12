import { google } from "googleapis";
import { subDays, addDays, startOfDay, formatISO, startOfWeek, endOfWeek } from "date-fns";
import { supabaseAdmin } from "./supabase";

// ── Colores verdes de Google Calendar ────────────────────────────────────────
const GREEN_COLOR_IDS = new Set(["2", "10"]);

// ── Config dinámica desde Supabase (cached 5 min) ─────────────────────────────
let _greenTypesCache: Set<EventType> | null = null;
let _procesosCache: Set<EventType> | null = null;
let _cierresCache: Set<EventType> | null = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

let _keywordsCache: Array<{ type: string; keywords: string[] }> | null = null;

async function getGreenTypes(): Promise<{ green: Set<EventType>; procesos: Set<EventType>; cierres: Set<EventType> }> {
  if (_greenTypesCache && Date.now() - _cacheTime < CACHE_TTL) {
    return { green: _greenTypesCache!, procesos: _procesosCache!, cierres: _cierresCache! };
  }
  try {
    const { data } = await supabaseAdmin.from("event_type_config").select("event_type, is_green, is_proceso, is_cierre, keywords");
    if (data?.length) {
      _greenTypesCache = new Set(data.filter(r => r.is_green).map(r => r.event_type as EventType));
      _procesosCache   = new Set(data.filter(r => r.is_proceso).map(r => r.event_type as EventType));
      _cierresCache    = new Set(data.filter(r => r.is_cierre).map(r => r.event_type as EventType));
      _keywordsCache   = data.filter(r => r.keywords).map(r => ({
        type: r.event_type,
        keywords: r.keywords.split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean),
      }));
      _cacheTime = Date.now();
      return { green: _greenTypesCache, procesos: _procesosCache, cierres: _cierresCache };
    }
  } catch {}
  return {
    green:    new Set(["tasacion","visita","primera_visita","propuesta","firma","conocer","reunion"] as EventType[]),
    procesos: new Set(["tasacion","primera_visita"] as EventType[]),
    cierres:  new Set(["firma"] as EventType[]),
  };
}

async function detectTypeDynamic(title: string): Promise<string | null> {
  if (!_keywordsCache || Date.now() - _cacheTime >= CACHE_TTL) await getGreenTypes();
  if (!_keywordsCache?.length) return null;
  const t = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Longer keywords first for specificity
  const sorted = [..._keywordsCache].sort((a, b) =>
    Math.max(...b.keywords.map(k => k.length)) - Math.max(...a.keywords.map(k => k.length))
  );
  for (const { type, keywords } of sorted) {
    if (keywords.some(kw => t.includes(kw))) return type;
  }
  return null;
}

export async function getEventTypeConfig(): Promise<{
  green: Set<string>;
  procesos: Set<string>;
  cierres: Set<string>;
  keywordsMap: Array<{ type: string; keywords: string[] }>;
}> {
  const { green, procesos, cierres } = await getGreenTypes();
  const keywordsMap = _keywordsCache || [];
  return { green: green as Set<string>, procesos: procesos as Set<string>, cierres: cierres as Set<string>, keywordsMap };
}

export function invalidateEventTypeCache() { _cacheTime = 0; }

// ── Tipos de eventos ──────────────────────────────────────────────────────────
export type EventType =
  | "tasacion"       // Tasación / Captación
  | "visita"         // Visita de venta / alquiler / autogestionada / con colega
  | "primera_visita" // Primera visita → proceso nuevo de compra
  | "fotos_video"    // Fotos y video / Creación de contenido → proceso nuevo de venta
  | "propuesta"      // Propuesta de valor / Presentación del servicio
  | "firma"          // Firma de contrato / escritura → cierre
  | "conocer"        // Conocer propiedad
  | "reunion"        // Reunión cara a cara genérica
  | "prospeccion"    // Prospección (verde solo si el usuario lo pintó)
  | "capacitacion"   // Entrenamiento y capacitación → amarillo
  | "llamada"        // Llamada → amarillo
  | "meet"           // Meet / Zoom → amarillo
  | "otro";          // Otro → amarillo

// EventTypes que SIEMPRE son verdes (cara a cara por naturaleza)
const ALWAYS_GREEN_TYPES = new Set<EventType>([
  "tasacion",
  "visita",
  "primera_visita",
  "propuesta",
  "firma",
  "conocer",
  "reunion",
]);

// EventTypes que son procesos nuevos (entrada real al embudo)
const PROCESO_NUEVO_TYPES = new Set<EventType>([
  "tasacion",        // proceso de venta nuevo
  "primera_visita",  // proceso de compra nuevo
]);

// EventTypes que son cierres
const CIERRE_TYPES = new Set<EventType>(["firma"]);

export interface SyncedEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: EventType;
  isGreen: boolean;         // cara a cara real
  isProceso: boolean;       // entrada al embudo comercial
  isCierre: boolean;        // cierre de operación
  isUserColored: boolean;   // el usuario lo pintó verde manualmente
  isOrganizer: boolean;     // false = fue invitado por otro, no cuenta como verde
  durationMinutes: number;
  attendeesCount: number;
}

export interface WeekStats {
  greenTotal: number;         // reuniones cara a cara
  iac: number;                // Índice de Actividad Comercial (0-100)
  iacGoal: number;            // objetivo semanal (15)
  procesosNuevos: number;     // procesos que entraron al embudo
  procesosGoal: number;       // objetivo semanal (3)
  tasaciones: number;
  visitas: number;
  primerasVisitas: number;
  fotosVideo: number;
  propuestas: number;
  firmas: number;
  reuniones: number;
  productiveDays: number;
  totalDays: number;
  productivityRate: number;
  weekDates: string;
}

export interface PeriodStats {
  total: number;              // reuniones verdes totales
  iac: number;                // IAC promedio semanal
  procesosNuevos: number;
  tasaciones: number;
  visitas: number;
  primerasVisitas: number;
  fotosVideo: number;
  propuestas: number;
  firmas: number;
  reuniones: number;
  productiveDays: number;
  avgPerWeek: number;
  conversionRate: number;     // firmas / tasaciones
  consistencyIndex: number;   // % semanas con ≥15 reuniones
}

// ── Detectar tipo de evento por keywords ──────────────────────────────────────
// Verifica que la keyword aparezca como palabra completa (no como substring de otra)
function hasWord(text: string, word: string): boolean {
  // Acepta: inicio/fin de string, espacios, puntos, comas, guiones, paréntesis
  const re = new RegExp(`(^|[\\s.,;:()/\\-])${word}($|[\\s.,;:()/\\-])`, "i");
  return re.test(text);
}

function detectType(title: string): EventType {
  const t = title.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // quita tildes para comparar

  // Cierres — "firma" como palabra completa para evitar "confirmar", "información", etc.
  if (hasWord(t, "firma") || t.includes("escritura")) return "firma";

  // Tasación / captación
  if (t.includes("tasac") || t.includes("captac")) return "tasacion";

  // Primera visita → proceso de compra
  if (t.includes("primera visita") || t.includes("1ra visita") || t.includes("1° visita")) return "primera_visita";

  // Fotos y video / creación de contenido → proceso de venta
  if (t.includes("foto") || t.includes("video") || t.includes("creacion de contenido") || t.includes("creación de contenido")) return "fotos_video";

  // Propuesta de valor / presentación
  if (t.includes("propuesta") || t.includes("presentacion") || t.includes("presentación")) return "propuesta";

  // Visitas (todas las variantes)
  if (
    t.includes("visita") ||
    t.includes("conocer propiedad") ||
    t.includes("conocer prop")
  ) {
    if (t.includes("conocer")) return "conocer";
    return "visita";
  }

  // Reunión cara a cara
  if (t.includes("reuni") || t.includes("meeting")) return "reunion";

  // Prospección — ambigua, verde solo si pintada
  if (t.includes("prospecc") || t.includes("prospección")) return "prospeccion";

  // Amarillos
  if (t.includes("llamada") || t.includes("call")) return "llamada";
  if (t.includes("meet") || t.includes("zoom") || t.includes("teams") || t.includes("videollamada")) return "meet";
  if (t.includes("capacitac") || t.includes("entrena") || t.includes("formac") || t.includes("curso")) return "capacitacion";

  return "otro";
}

// ── Determinar si un evento es verde ─────────────────────────────────────────
// Prioridad 1: el usuario lo pintó verde → siempre verde
// Prioridad 2: el tipo es cara a cara por naturaleza → verde
// Prospección solo es verde si fue pintada
async function computeIsGreenAsync(event: any, type: EventType): Promise<{ isGreen: boolean; isUserColored: boolean }> {
  const isUserColored = !!(event.colorId && GREEN_COLOR_IDS.has(event.colorId));
  if (isUserColored) return { isGreen: true, isUserColored: true };
  const { green } = await getGreenTypes();
  if (green.has(type)) return { isGreen: true, isUserColored: false };
  return { isGreen: false, isUserColored: false };
}

function durationMinutes(event: any): number {
  if (!event.start?.dateTime || !event.end?.dateTime) return 60;
  return Math.round((new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / 60000);
}

function attendeesCount(event: any): number {
  return event.attendees?.length ?? 1;
}

// ── IAC: Índice de Actividad Comercial ───────────────────────────────────────
export const IAC_GOAL = 15;        // reuniones/semana
export const PROCESOS_GOAL = 3;    // procesos nuevos/semana
export const CARTERA_GOAL = 25;    // propiedades vendibles (no medible, solo consejo)
export const EFECTIVIDAD = 0.15;   // 15% — promedio del mercado

export function calcIAC(reuniones: number, goal = IAC_GOAL): number {
  return Math.round((reuniones / goal) * 100);
}

// Proyección de operaciones en base a procesos y efectividad de mercado
export function proyectarOperaciones(procesosNuevos: number, semanas: number): number {
  const totalProcesos = procesosNuevos * semanas;
  return Math.round(totalProcesos * EFECTIVIDAD * 10) / 10;
}

// ── Fetch desde Google Calendar ───────────────────────────────────────────────
export async function fetchCalendarEvents(
  accessToken: string,
  days = 90
): Promise<SyncedEvent[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const timeMin = formatISO(startOfDay(subDays(now, days)));
  const timeMax = formatISO(addDays(now, 30)); // 30 días hacia adelante

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 2500,
  });

  const items = (response.data.items || []).filter(e =>
    e.status !== "cancelled" &&
    e.summary
  );
  const { green, procesos, cierres } = await getGreenTypes();

  return Promise.all(items.map(async e => {
    const dynamicType = await detectTypeDynamic(e.summary!);
    const type = (dynamicType || detectType(e.summary!)) as EventType;
    const isUserColored = !!(e.colorId && GREEN_COLOR_IDS.has(e.colorId));
    const isOrganizer = e.organizer?.self !== false; // true si no hay organizer (evento propio sin invitados)
    const isGreen = isOrganizer && (isUserColored || green.has(type));
    return {
      id: e.id!,
      title: e.summary!,
      start: e.start?.dateTime ? new Date(e.start.dateTime).toISOString() : (e.start?.date ? e.start.date + "T00:00:00.000Z" : ""),
      end: e.end?.dateTime ? new Date(e.end.dateTime).toISOString() : (e.end?.date ? e.end.date + "T00:00:00.000Z" : ""),
      type,
      isGreen,
      isProceso: isOrganizer && procesos.has(type),
      isCierre: isOrganizer && cierres.has(type),
      isUserColored,
      isOrganizer,
      durationMinutes: durationMinutes(e),
      attendeesCount: attendeesCount(e),
    } as SyncedEvent;
  }));
}

// ── Persistir eventos en Supabase ─────────────────────────────────────────────
export async function persistEvents(
  userEmail: string,
  teamId: string | null | undefined,
  events: SyncedEvent[]
): Promise<void> {
  if (!events.length) return;

  const rows = events
    .filter(e => e.start)
    .map(e => ({
      user_email: userEmail,
      team_id: teamId || null,
      google_event_id: e.id,
      title: e.title,
      start_at: e.start,
      end_at: e.end || e.start,
      attendees_count: e.attendeesCount,
      event_type: e.type,
      is_productive: e.isGreen,
      is_proceso: e.isProceso,
      is_cierre: e.isCierre,
      is_user_colored: e.isUserColored,
      is_organizer: e.isOrganizer,
    }));

  await supabaseAdmin
    .from("calendar_events")
    .upsert(rows, { onConflict: "user_email,google_event_id", ignoreDuplicates: false });
}

// ── Sync completo ─────────────────────────────────────────────────────────────
export async function syncAndPersist(
  accessToken: string,
  userEmail: string,
  teamId: string | null | undefined,
  days = 30
): Promise<SyncedEvent[]> {
  const events = await fetchCalendarEvents(accessToken, days);
  await persistEvents(userEmail, teamId, events);
  return events;
}

// ── Leer eventos desde Supabase ───────────────────────────────────────────────
export async function getStoredEvents(
  userEmail: string,
  from: Date,
  to: Date
): Promise<SyncedEvent[]> {
  const { data } = await supabaseAdmin
    .from("calendar_events")
    .select("*")
    .eq("user_email", userEmail)
    .gte("start_at", from.toISOString())
    .lte("start_at", to.toISOString())
    .order("start_at", { ascending: true });

  return (data || []).map(r => ({
    id: r.google_event_id,
    title: r.title,
    start: r.start_at,
    end: r.end_at,
    type: r.event_type as EventType,
    isGreen: r.is_productive,
    isProceso: r.is_proceso ?? false,
    isCierre: r.is_cierre ?? false,
    isUserColored: r.is_user_colored ?? false,
    isOrganizer: r.is_organizer ?? true,
    durationMinutes: r.duration_minutes ?? 60,
    attendeesCount: r.attendees_count ?? 1,
  }));
}

// ── Stats de un período ───────────────────────────────────────────────────────
export function computePeriodStats(events: SyncedEvent[], periodDays: number): PeriodStats {
  const prod = events.filter(e => e.isGreen);
  const t = (type: EventType) => prod.filter(e => e.type === type).length;

  const tasaciones = t("tasacion");
  const firmas = t("firma") + prod.filter(e => e.isCierre).length;
  const procesosNuevos = prod.filter(e => e.isProceso).length;

  // Días con ≥10 reuniones
  const byDay: Record<string, number> = {};
  prod.forEach(e => {
    const day = e.start.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  });
  const productiveDays = Object.values(byDay).filter(c => c >= 10).length;

  // Consistencia: % de semanas con ≥15 reuniones (IAC_GOAL)
  const byWeek: Record<string, number> = {};
  prod.forEach(e => {
    const d = new Date(e.start);
    const weekStart = startOfWeek(d, { weekStartsOn: 1 }).toISOString().slice(0, 10);
    byWeek[weekStart] = (byWeek[weekStart] || 0) + 1;
  });
  const weeks = Object.values(byWeek);
  const productiveWeeks = weeks.filter(c => c >= IAC_GOAL).length;
  const totalWeeks = Math.max(1, Math.ceil(periodDays / 7));
  const consistencyIndex = Math.round((productiveWeeks / totalWeeks) * 100);
  const avgPerWeek = Math.round((prod.length / totalWeeks) * 10) / 10;
  const iac = calcIAC(avgPerWeek);
  const conversionRate = tasaciones > 0 ? Math.round((firmas / tasaciones) * 100) : 0;

  return {
    total: prod.length,
    iac,
    procesosNuevos,
    tasaciones,
    visitas: t("visita") + t("primera_visita") + t("conocer"),
    primerasVisitas: t("primera_visita"),
    fotosVideo: t("fotos_video"),
    propuestas: t("propuesta"),
    firmas,
    reuniones: t("reunion"),
    productiveDays,
    avgPerWeek,
    conversionRate,
    consistencyIndex,
  };
}

// ── WeekStats (para el dashboard) ────────────────────────────────────────────
export function computeWeekStats(events: SyncedEvent[], goalPerDay = 10): WeekStats {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const week = events.filter(e => {
    const d = new Date(e.start);
    return d >= weekStart && d <= weekEnd && e.isGreen;
  });

  const byDay: Record<string, number> = {};
  week.forEach(e => {
    const day = new Date(e.start).toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  });

  const workDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  }).filter(d => new Date(d).getDay() !== 0);

  const productiveDays = workDays.filter(d => (byDay[d] || 0) >= goalPerDay).length;
  const t = (type: EventType) => week.filter(e => e.type === type).length;
  const greenTotal = week.length;
  const procesosNuevos = week.filter(e => e.isProceso).length;

  return {
    greenTotal,
    iac: calcIAC(greenTotal),
    iacGoal: IAC_GOAL,
    procesosNuevos,
    procesosGoal: PROCESOS_GOAL,
    tasaciones: t("tasacion"),
    visitas: t("visita") + t("conocer"),
    primerasVisitas: t("primera_visita"),
    fotosVideo: t("fotos_video"),
    propuestas: t("propuesta"),
    firmas: t("firma") + week.filter(e => e.isCierre).length,
    reuniones: t("reunion"),
    productiveDays,
    totalDays: workDays.length,
    productivityRate: workDays.length > 0 ? Math.round((productiveDays / workDays.length) * 100) : 0,
    weekDates: `${weekStart.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`,
  };
}

// ── Períodos estándar ─────────────────────────────────────────────────────────
export function getQuarter(q: 1 | 2 | 3 | 4, year: number): { from: Date; to: Date; days: number } {
  const starts = [0, 3, 6, 9];
  const from = new Date(year, starts[q - 1], 1);
  const to = new Date(year, starts[q - 1] + 3, 0, 23, 59, 59);
  const days = Math.ceil((to.getTime() - from.getTime()) / 86400000);
  return { from, to, days };
}

export function getSemester(s: 1 | 2, year: number): { from: Date; to: Date; days: number } {
  const from = new Date(year, s === 1 ? 0 : 6, 1);
  const to = new Date(year, s === 1 ? 6 : 12, 0, 23, 59, 59);
  const days = Math.ceil((to.getTime() - from.getTime()) / 86400000);
  return { from, to, days };
}

export function getYear(year: number): { from: Date; to: Date; days: number } {
  return {
    from: new Date(year, 0, 1),
    to: new Date(year, 11, 31, 23, 59, 59),
    days: 365,
  };
}
