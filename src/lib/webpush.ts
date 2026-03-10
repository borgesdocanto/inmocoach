import webpush from "web-push";
import { supabaseAdmin } from "./supabase";

webpush.setVapidDetails(
  "mailto:coach@inmocoach.com.ar",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  actions?: { action: string; title: string }[];
}

export async function sendPushToUser(email: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("email", email);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  let sent = 0, failed = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 6 } // expira en 6 horas
        );
        sent++;
      } catch (err: any) {
        // 410 Gone = subscription inválida, borrarla
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin.from("push_subscriptions").delete()
            .eq("email", email).eq("endpoint", sub.endpoint);
        }
        failed++;
      }
    })
  );

  return { sent, failed };
}

export async function sendPushToMany(
  emails: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number; noSub: number }> {
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("email, endpoint, p256dh, auth")
    .in("email", emails);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0, noSub: emails.length };

  const subEmails = new Set(subs.map(s => s.email));
  const noSub = emails.filter(e => !subEmails.has(e)).length;

  let sent = 0, failed = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 6 }
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin.from("push_subscriptions").delete()
            .eq("email", sub.email).eq("endpoint", sub.endpoint);
        }
        failed++;
      }
    })
  );

  return { sent, failed, noSub };
}
