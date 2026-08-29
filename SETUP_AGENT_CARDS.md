# Setup Agent Digital Cards — Configuración Manual

## ✅ Paso 1: Migración SQL (COMPLETADO)

La migración ya se ejecutó:
- Tabla `agent_profiles` creada
- Tabla `agent_profile_edits` creada (auditoría)
- RLS policies configuradas
- Índices creados
- Trigger `updated_at` instalado

Verificar en Supabase:
```
Supabase → Tables → agent_profiles (debe existir)
```

---

## 📦 Paso 2: Crear bucket de Storage `agent-photos`

### **Opción A: Vía Supabase UI (más fácil)**

1. Ir a [Supabase Console](https://app.supabase.com) → Proyecto `hjyyqxjzlgiywgvikzsa`
2. Click en **Storage** (lado izquierdo)
3. Click en **Create a new bucket**
4. Completar:
   - **Bucket name:** `agent-photos`
   - **Privacidad:** Public (marcar checkbox)
5. Click **Create bucket**

✅ Hecho. Las fotos se almacenarán en `agent-photos/agent@email.com-timestamp.jpg`

### **Opción B: Vía script Node.js**

```bash
# Opción 1: Con Vercel CLI (automático)
vercel env pull
npx tsx scripts/create-storage-bucket.ts

# Opción 2: Manual
export SUPABASE_SERVICE_ROLE_KEY="tu_service_role_key"
npx tsx scripts/create-storage-bucket.ts
```

Dónde obtener `SUPABASE_SERVICE_ROLE_KEY`:
- Supabase → Project Settings → API → Service Role Key
- O desde Vercel: `vercel env ls` (guardada en variables de entorno del proyecto)

---

## 🧪 Paso 3: Verificar que todo funciona

### **En Supabase:**
1. SQL Editor → run query:
   ```sql
   SELECT * FROM public.agent_profiles LIMIT 1;
   ```
   Debe funcionar sin errores

2. Storage → `agent-photos` bucket debe existir

### **En InmoCoach (app):**

1. **Ir a** `/config/agent-profile`
2. **Completar:**
   - Bio
   - Teléfono
   - Email contacto
   - Redes sociales
   - Slug
3. **Subir foto** (debe guardar en Storage)
4. **Guardar** cambios

5. **Ir a** `/agents` → debe listar el agente
6. **Click en agente** → `/agents/[slug]`
   - Debe mostrar foto, bio, contacto, propiedades de Tokko

---

## 🔐 RLS Policies — Verificación

En Supabase → Table Editor → agent_profiles → RLS Policies:

Deben existir 4 políticas:
- ✅ "Service role full access" — Permite al backend todo
- ✅ "Agents can view and edit own profile" — Cada agente edita su perfil
- ✅ "Team leaders can manage their agents" — TL edita su equipo
- ✅ "Public can view visible profiles" — Público ve perfiles públicos

Si faltan, ejecutar en SQL Editor:
```sql
-- Recriar las políticas (ver supabase-agent-profiles.sql)
```

---

## 📝 Checklist

- [ ] Tabla `agent_profiles` existe en Supabase
- [ ] Tabla `agent_profile_edits` existe en Supabase
- [ ] Bucket `agent-photos` existe en Storage
- [ ] RLS habilitado en `agent_profiles`
- [ ] 4 RLS policies creadas
- [ ] Endpoints API funcionan (`/api/agent-profile`, `/api/agents/[slug]`)
- [ ] Páginas renderean (`/config/agent-profile`, `/agents`, `/agents/[slug]`)
- [ ] Upload de foto funciona
- [ ] Broker puede editar agentes (`/equipo/agente/[email]/card`)

---

## 🚀 Desplegar a Vercel

Una vez todo esté configurado en Supabase:

```bash
cd inmocoach
git pull origin main
git push origin main  # Triggers Vercel deploy
```

El deploy automático va a:
1. Build Next.js
2. Deploy a `inmocoach.com.ar`
3. Usar `agent-photos` bucket de Supabase

---

## 📞 Troubleshooting

### "Error: relation \"agent_profiles\" does not exist"
- La migración SQL no se ejecutó correctamente
- Solución: Ejecutar manualmente en Supabase SQL Editor

### "Error uploading photo: 403 Forbidden"
- Bucket `agent-photos` no es público
- Solución: Supabase → Storage → agent-photos → Policies → Public

### "Error uploading photo: 400 Bad Request"
- Archivo no es imagen o está corrupto
- Solución: Usar JPG, PNG, GIF o WebP. Máx 5MB

### "Profile not found" en `/agents/[slug]`
- El agente no existe o `is_visible = false`
- Solución: Ir a `/config/agent-profile` y completar datos

---

## 🎯 Próximo: Fase 2

Una vez Agent Cards Phase 1 esté funcionando:
- Subdominio `card.galas.com.ar`
- Sincronización automática de foto desde Tokko
- Estadísticas del agente (racha, ranking)
- Formulario de contacto en landing
