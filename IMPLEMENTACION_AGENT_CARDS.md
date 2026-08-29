# Implementación: Agent Digital Cards — Fase 1

**Estado:** ✅ Código completado y pusheado a `main`  
**Próximo paso:** Ejecutar migración SQL en Supabase

---

## 1. Qué se implementó

### **Tabla Supabase: `agent_profiles`**
- Almacena datos personales, foto, bio, contacto y redes de cada agente
- Campo `slug` único para URL amigable (`/agents/hernan-dinter`)
- Control de visibilidad (`is_visible`)
- Timestamps (`created_at`, `updated_at`)
- Constraints para validación (slug alfanumérico, teléfono numérico)

### **Endpoints API**
1. **`GET /api/agents`** — Lista todos los agentes públicos (sin auth)
2. **`GET /api/agents/[slug]`** — Perfil + propiedades del agente (sin auth)
3. **`GET /api/agent-profile`** — Mi perfil (auth requerida)
4. **`PUT /api/agent-profile`** — Actualizar mi perfil (auth requerida)
5. **`POST /api/agent-profile/upload-photo`** — Subir foto a Supabase Storage
6. **`PUT /api/admin/agent-profile?agentEmail=X`** — Broker/Team leader edita agente

### **Páginas Frontend**
1. **`/config/agent-profile`** — Formulario privado para que cada agente edite su card
2. **`/agents`** — Directorio público con lista de todos los agentes (filtro por rama preparado)
3. **`/agents/[slug]`** — Landing individual del agente con:
   - Foto, bio, contacto (teléfono, email, WhatsApp)
   - Redes sociales (Instagram, LinkedIn)
   - Listado de propiedades del agente en Tokko
   - Link a `propiedades.galas.com.ar` para ver cartera completa
4. **`/equipo/agente/[email]/card`** — Panel para broker/team leader edite los datos de sus agentes

### **Permisos (RLS Supabase)**
- Agente puede **ver y editar su propio perfil**
- Team leader puede **ver y editar perfiles de su equipo**
- Owner/Broker puede **editar todos**
- Público puede **ver perfiles con `is_visible=true`**
- Service role (backend) tiene **acceso total**

---

## 2. Instalación en Supabase

### **Paso 1: Ejecutar migración SQL**
Ir a Supabase → SQL Editor → copiar y ejecutar el contenido de:
```
supabase-agent-profiles.sql
```

Esto crea:
- Tabla `agent_profiles` con índices
- Tabla auxiliar `agent_profile_edits` (para auditoría, fase 2)
- Trigger para `updated_at`
- RLS policies

### **Paso 2: Crear bucket de Storage**
Ir a Supabase → Storage → Buckets → New Bucket:
- **Nombre:** `agent-photos`
- **Privacidad:** Public (para que las URLs sean públicas)

Crear carpeta (opcional): `agent-profiles/`

### **Paso 3: Configurar CORS (si es necesario)**
En Supabase → Storage → Policies → No debería ser necesario porque usamos service role en backend.

---

## 3. Flujos principales

### **Agente completa su card**
1. Accede a `/config/agent-profile`
2. Sube foto (se almacena en `agent-photos/` en Supabase Storage)
3. Completa: bio, teléfono, email contacto, redes sociales
4. Edita slug (ej: "hernan-dinter")
5. Activa visibilidad (`is_visible = true`)
6. Guarda → endpoint `PUT /api/agent-profile`
7. Perfil disponible en `https://inmocoach.com.ar/agents/hernan-dinter`

### **Broker/Team leader edita card de un agente**
1. Va a `/equipo/agente/hernan@galas.com.ar`
2. Click en "Editar card" → `/equipo/agente/hernan@galas.com.ar/card`
3. Actualiza datos del agente
4. Click "Guardar cambios" → endpoint `PUT /api/admin/agent-profile?agentEmail=hernan@galas.com.ar`
5. Los cambios se reflejan inmediatamente en la landing

### **Público ve directorio de agentes**
1. Accede a `https://inmocoach.com.ar/agents` (sin login)
2. Ve lista de todos los agentes con `is_visible=true`
3. Click en card → landing individual `/agents/[slug]`
4. Ve: foto, bio, contacto, redes, propiedades del agente
5. Link "Ver todas las propiedades" → `https://propiedades.galas.com.ar`

---

## 4. Foto del agente — Estrategia

**Fase 1 (actual):** Upload manual desde `/config/agent-profile`

**Fase 2 (próxima):** Sincronización automática desde Tokko
- En el cron `daily-sync` → buscar foto del agente en Tokko
- Si existe → guardar en `agent_profiles.photo_url`
- Si no → mantener foto manual o avatar con iniciales

```typescript
// Pseudocódigo para Fase 2
async function syncAgentPhotoFromTokko(email: string, apiKey: string) {
  const agent = await getTokkoAgent(apiKey, email);
  if (agent.photo_url) {
    await supabaseAdmin
      .from('agent_profiles')
      .update({ photo_url: agent.photo_url })
      .eq('email', email);
  }
}
```

---

## 5. Integración con Tokko — Propiedades

**Cómo funcionan las propiedades en la landing:**

1. Endpoint `GET /api/agents/[slug]` obtiene:
   - Perfil del agente (de `agent_profiles`)
   - Propiedades del agente (de `tokko_properties` filtradas por `producer_email`)
   
2. La tabla `tokko_properties` ya se sincroniza diariamente via `cron/tokko-sync.ts`

3. Muestra:
   - Todas las propiedades publicadas (`status = 2`)
   - Ordenadas por `days_since_update` (más recientes primero)
   - Card simple con: dirección, precio, cantidad de fotos, últimos días de actualización
   - Link a `https://propiedades.galas.com.ar/propiedad/[tokko_id]`

---

## 6. Cambios en página `/equipo/agente/[email]`

**Pendiente:** Agregar botón "Editar card" en la página de perfil del agente
```tsx
<Link href={`/equipo/agente/${email}/card`} className="btn btn-primary">
  Editar card digital
</Link>
```

---

## 7. Fase 2 — Subdominio `card.galas.com.ar`

**Qué hay que hacer:**

1. **DNS:** Agregar CNAME en registrador que apunte a Vercel
   ```
   card.galas.com.ar  CNAME  cname.vercel-dns.com
   ```

2. **Vercel:** Agregar dominio al proyecto en Settings → Domains

3. **Next.js rewrites:** En `next.config.js` agregar:
   ```javascript
   rewrites() {
     return {
       beforeFiles: [
         {
           source: '/agente/:slug',
           destination: '/agents/:slug',
         },
       ],
     };
   }
   ```

4. **Alias:** `/card/agente/[slug]` redirige a `/agents/[slug]`

---

## 8. Checklist antes de deployar a producción

- [ ] Ejecutar migración SQL en Supabase
- [ ] Crear bucket `agent-photos` en Supabase Storage
- [ ] Verificar RLS policies (especialmente `Service role full access`)
- [ ] Testear en Vercel deploy (automático cuando merge a main)
- [ ] Crear perfil de prueba en `/config/agent-profile` con test user
- [ ] Verificar landing pública en `/agents` y `/agents/[slug]`
- [ ] Broker prueba editar agente en `/equipo/agente/[email]/card`
- [ ] Testear upload de foto
- [ ] Verificar links a Tokko properties
- [ ] Agregar botón "Editar card" en `/equipo/agente/[email]` (si existe esa página)

---

## 9. Archivos modificados/creados

### **Nuevas rutas**
```
src/pages/agents/index.tsx              — Directorio público
src/pages/agents/[slug].tsx             — Landing individual
src/pages/config/agent-profile.tsx      — Config privada del agente
src/pages/equipo/agente/[email]/card.tsx — Edición broker/team leader
```

### **Nuevos endpoints**
```
src/pages/api/agents/index.ts           — GET lista agentes
src/pages/api/agents/[slug].ts          — GET perfil + propiedades
src/pages/api/agent-profile.ts          — GET/PUT mi perfil
src/pages/api/agent-profile/upload-photo.ts — POST foto
src/pages/api/admin/agent-profile.ts    — PUT editar agente (admin)
```

### **Migración SQL**
```
supabase-agent-profiles.sql             — Tabla + RLS + índices
```

---

## 10. Notas de desarrollo

- **Storage:** Supabase Storage es gratis hasta 1GB. Fotos se almacenan con patrón:
  ```
  agent-photos/agente@email.com-1693948800.jpg
  ```

- **Slug normalización:** Automático en backend via función `generateSlug()`. 
  - Ejemplo: "Hernán Dinter" → "hernan-dinter"
  - Duplicados se rechazan con error 400

- **Performance:** Índices en `email`, `team_id`, `slug`, `(is_visible, team_id)` para queries rápidas

- **Foto fallback:** Si no hay foto, muestra:
  - Avatar con iniciales (letra del email)
  - Gradiente azul como fondo

- **Publicación:** La landing está completamente abierta (sin auth). No requiere login.

---

## 11. Próximos pasos opcionales

1. **Estadísticas del agente en su card:**
   - Total propiedades activas
   - Racha/ranking (si aplica)
   - Últimas transacciones

2. **Formulario de contacto en landing:**
   - "Enviar consulta" → email al agente

3. **Galería de fotos de propiedades:**
   - Mostrar 3-5 fotos principales de cada propiedad en card

4. **QR code:**
   - Generar QR que linkea a la landing → compartir por WhatsApp

5. **Social share buttons:**
   - Botones para compartir landing en redes

---

**Commit:** `6be0225` — feat: agent digital cards (agent profiles) - MVP Fase 1
