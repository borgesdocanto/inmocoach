# GALAS Management System

Sistema de gestión de productividad inmobiliaria sincronizado con Google Calendar.

## Cómo funciona

1. El agente entra con su cuenta Gmail (o dominio propio)
2. Al abrir la app, **sincroniza automáticamente** su Google Calendar
3. Detecta los **Eventos Verdes** (cara a cara, 1 a 1): tasaciones, visitas, propuestas, reuniones
4. Muestra métricas de productividad, tendencias y análisis con Coach IA
5. Meta: **10 eventos verdes por día** = día productivo

## Setup en 5 pasos

### 1. Cloná el repo y configurá variables

```bash
cp .env.example .env.local
```

Completá `.env.local`:

```env
NEXTAUTH_SECRET=           # openssl rand -base64 32
NEXTAUTH_URL=              # https://tu-app.vercel.app
GOOGLE_CLIENT_ID=          # De Google Cloud Console
GOOGLE_CLIENT_SECRET=      # De Google Cloud Console
ALLOWED_DOMAIN=            # Ej: galas.com.ar (opcional, dejar vacío para cualquier Gmail)
NEXT_PUBLIC_PRODUCTIVITY_GOAL=10
```

### 2. Configurá Google Cloud Console

1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Crear proyecto nuevo → "GALAS Management"
3. Habilitar **Google Calendar API**
4. Ir a "Credenciales" → "Crear credenciales" → "ID de cliente OAuth 2.0"
5. Tipo: **Aplicación web**
6. Authorized redirect URIs: `https://tu-app.vercel.app/api/auth/callback/google`
7. Copiar Client ID y Client Secret al `.env.local`

> Si usás Google Workspace (dominio propio), también configurá la "Pantalla de consentimiento OAuth" con tu dominio.

### 3. Deploy en Vercel

```bash
# Conectar repo de GitHub en vercel.com
# Agregar las variables de entorno en Settings → Environment Variables
# Deploy automático
```

### 4. Variables en Vercel

En el dashboard de Vercel → Settings → Environment Variables, agregar todas las del `.env.local`.

### 5. Listo

Cada agente entra con su Gmail, autoriza una sola vez, y la app sincroniza su Calendar automáticamente en cada apertura.

---

## Identificación de Eventos Verdes

El sistema detecta como **productivo** cualquier evento que:
- Tenga **colorId verde** en Google Calendar (Sage o Basil)
- O contenga alguna de estas palabras en el título:
  - `tasacion` / `tasación`
  - `visita`
  - `propuesta`
  - `reunion` / `reunión`
  - `meeting`
  - `seguimiento`
  - `cierre`
  - `entrevista`

## Estructura del proyecto

```
src/
  pages/
    index.tsx          # Dashboard principal
    login.tsx          # Login con Google
    api/
      auth/[...nextauth].ts  # NextAuth + OAuth
      calendar.ts            # Sync con Google Calendar API
  styles/
    globals.css
```

## Stack

- **Next.js 14** — framework
- **NextAuth.js** — autenticación Google OAuth
- **Google Calendar API** — via googleapis
- **Recharts** — gráficos
- **Tailwind CSS** — estilos
- **Lucide React** — iconos
- **Vercel** — deploy
