const CACHE_NAME = "inmocoach-v1";

// Instalar SW
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Recibir push notification
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "InmoCoach", body: event.data.text(), icon: "/android-chrome-192x192.png" };
  }

  const options = {
    body: payload.body || "Tenés una notificación de InmoCoach",
    icon: "/android-chrome-192x192.png",
    badge: "/favicon-32x32.png",
    tag: payload.tag || "inmocoach",
    renotify: true,
    requireInteraction: false,
    data: { url: payload.url || "/" },
    actions: payload.actions || [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "InmoCoach", options)
  );
});

// Click en la notificación
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una ventana abierta, la enfoca
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Si no, abre una nueva
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
