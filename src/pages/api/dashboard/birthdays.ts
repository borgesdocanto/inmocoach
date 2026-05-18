import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/react";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase";
import { getEffectiveEmail } from "../../lib/impersonation";

export interface UpcomingBirthday {
  email: string;
  name: string;
  birthday: string; // "YYYY-MM-DD"
  daysUntil: number;
  isToday: boolean;
}

function getDaysUntilBirthday(birthday: string): number {
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  const bDate = new Date(birthday);
  const bMonth = bDate.getMonth() + 1;
  const bDay = bDate.getDate();

  // Próximo cumpleaños este año o el que viene
  let nextBirthday = new Date(today.getFullYear(), bMonth - 1, bDay);
  if (
    nextBirthday.getMonth() + 1 < todayMonth ||
    (nextBirthday.getMonth() + 1 === todayMonth && nextBirthday.getDate() < todayDay)
  ) {
    nextBirthday = new Date(today.getFullYear() + 1, bMonth - 1, bDay);
  }

  const diff = nextBirthday.getTime() - new Date(today.getFullYear(), todayMonth - 1, todayDay).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "No autenticado" });

  const effectiveEmail = getEffectiveEmail(req, session);

  const { data: requester } = await supabaseAdmin
    .from("subscriptions")
    .select("team_id")
    .eq("email", effectiveEmail)
    .single();

  if (!requester?.team_id) return res.json({ birthdays: [] });

  // Traer todos los miembros del equipo con cumpleaños cargado
  const { data: members } = await supabaseAdmin
    .from("subscriptions")
    .select("email, name, birthday")
    .eq("team_id", requester.team_id)
    .not("birthday", "is", null);

  if (!members || members.length === 0) return res.json({ birthdays: [] });

  const DAYS_AHEAD = 15;

  const upcoming: UpcomingBirthday[] = members
    .filter((m) => m.email !== effectiveEmail) // excluir al propio usuario
    .map((m) => ({
      email: m.email,
      name: m.name || m.email,
      birthday: m.birthday,
      daysUntil: getDaysUntilBirthday(m.birthday),
      isToday: getDaysUntilBirthday(m.birthday) === 0,
    }))
    .filter((m) => m.daysUntil <= DAYS_AHEAD)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return res.json({ birthdays: upcoming });
}
