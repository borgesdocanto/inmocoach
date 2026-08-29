# ✅ Agent Digital Cards — LISTO PARA USAR

**Estado:** Código deployado en Vercel. El sistema está auto-inicializándose.

---

## 🚀 Lo que está funcionando AHORA

### **Datos en Supabase**
✅ Tabla `agent_profiles` con 8 agentes de GALAS listos
✅ RLS policies configuradas (agente, team leader, owner, público)
✅ Índices de performance activos

### **Auto-inicialización**
✅ Hook `useAgentCardsInit()` ejecuta health check al cargar
✅ Función `ensureAgentPhotosBucket()` crea Storage bucket automáticamente
✅ Endpoint `/api/health/agent-cards` verifica estado
✅ Endpoint `/api/admin/setup-agent-cards` fuerza setup manual

### **URLs Públicas (NO requieren login)**
✅ `https://inmocoach.com.ar/agents` — Directorio de agentes
✅ `https://inmocoach.com.ar/agents/hernan-dinter` — Landing individual
✅ `https://inmocoach.com.ar/agents/leandro-borges` — Landing Leandro
✅ (Y todas las combinaciones del slug de cada agente)

### **URLs Privadas (Requieren login)**
✅ `https://inmocoach.com.ar/config/agent-profile` — Editar mi card
✅ `https://inmocoach.com.ar/equipo/agente/hernan@galas.com.ar/card` — Broker edita agente

---

## 📋 Agentes creados (con slug automático)

| Email | Slug | Status |
|-------|------|--------|
| leandro@galas.com.ar | leandro-borges | ✅ Público |
| luciana@galas.com.ar | luciana-cajal | ✅ Público |
| hernan@galas.com.ar | hernan-dinter | ✅ Público |
| tobias@galas.com.ar | tobias-martinez | ✅ Público |
| sandra@galas.com.ar | sandra-ruggeri | ✅ Público |
| analia@galas.com.ar | analia-arguello | ✅ Público |
| llucero@galas.com.ar | leandro-lucero | ✅ Público |
| matias@galas.com.ar | matias-alvarez | ✅ Público |

---

## 🧪 Cómo testear AHORA

### **1. Ver directorio público**
Abrir en navegador: `https://inmocoach.com.ar/agents`
- Debe mostrar 8 tarjetas de agentes
- Click en cualquiera → landing individual

### **2. Ver landing de un agente**
`https://inmocoach.com.ar/agents/hernan-dinter`
- Foto (por ahora vacía, agentes pueden subir)
- Bio (pre-poblada)
- Contacto (email, teléfono, WhatsApp, redes)
- Propiedades Tokko del agente
- Link a propiedades.galas.com.ar

### **3. Agente actualiza su perfil (CON LOGIN)**
1. Login como `hernan@galas.com.ar` (o cualquier agente)
2. Ir a `https://inmocoach.com.ar/config/agent-profile`
3. Completar datos (los datos ya están pre-poblados)
4. Subir foto → Debe guardarse en Supabase Storage automáticamente
5. Cambiar slug si lo desea
6. Guardar → cambios visibles inmediatamente en `/agents/[slug]`

### **4. Broker edita card de agente (CON LOGIN COMO BROKER)**
1. Login como `leandro@galas.com.ar`
2. Ir a `/equipo/agente/hernan@galas.com.ar/card`
3. Editar bio, contacto, redes
4. Guardar → cambios visibles en `/agents/hernan-dinter`

### **5. Verificar que Storage funciona**
`curl https://www.inmocoach.com.ar/api/health/agent-cards | jq`

Debe devolver:
```json
{
  "status": "healthy",
  "database": {
    "connected": true,
    "agent_profiles_table": true
  },
  "storage": {
    "agent_photos_bucket": true
  }
}
```

---

## 📸 Foto del agente — Flujo

1. Agente va a `/config/agent-profile`
2. Click "Cambiar foto"
3. Selecciona imagen (JPG, PNG, GIF, WebP, máx 5MB)
4. Sistema automaticamente:
   - Crea bucket `agent-photos` si no existe
   - Sube foto a `agent-photos/email-timestamp.jpg`
   - Guarda URL en `agent_profiles.photo_url`
   - Landing se actualiza automáticamente

---

## 🔐 Permisos — Quién puede hacer qué

| Acción | Agente | Team Leader | Owner/Broker | Público |
|--------|--------|-------------|-------------|---------|
| Ver mi card | ✅ | ✅ | ✅ | ✅ |
| Editar mi bio | ✅ | ❌ | ✅ | ❌ |
| Editar bio de otro | ❌ | ✅ (su equipo) | ✅ | ❌ |
| Ver cards públicas | ✅ | ✅ | ✅ | ✅ |
| Ocultar card | ✅ | ✅ | ✅ | ❌ |

---

## 🔧 Endpoints de utilidad

```
GET    /api/agents                          — Todos los agentes
GET    /api/agents/[slug]                   — Perfil + propiedades
GET    /api/health/agent-cards              — Health check
POST   /api/admin/setup-agent-cards         — Forzar setup (admin)
GET    /api/agent-profile                   — Mi perfil (auth)
PUT    /api/agent-profile                   — Actualizar perfil (auth)
POST   /api/agent-profile/upload-photo      — Upload foto (auth)
```

---

## ⚙️ Cambios recientes

✅ 8 agentes con perfiles iniciales creados en Supabase
✅ Auto-inicialización de Storage bucket
✅ Health check endpoint
✅ Setup force endpoint
✅ Hook de inicialización en `_app.tsx`
✅ Endpoints de API completamente funcionales

---

## 📊 Fase 1 — COMPLETADA

- ✅ Tabla agent_profiles
- ✅ Permisos (RLS)
- ✅ Endpoints CRUD
- ✅ Páginas públicas (/agents, /agents/[slug])
- ✅ Página privada agente (/config/agent-profile)
- ✅ Página admin editar agente (/equipo/agente/[email]/card)
- ✅ Upload de foto automático
- ✅ Auto-inicialización

---

## 🎯 Fase 2 — Próxima (cuando lo necesites)

- Subdominio `card.galas.com.ar`
- Sincronización automática de foto desde Tokko
- Estadísticas en landing (racha, ranking)
- Formulario de contacto
- QR code compartible

---

## 📞 Para verificar que está funcionando

**Ir a:** `https://inmocoach.com.ar/agents`

Si ves 8 tarjetas de agentes con foto (falta), bio, y opciones de contacto, **está 100% funcionando**.

---

**Commit:** `a58ed6a` — feat: agent cards - auto-initialization y setup
**Timestamp:** Ya desplegado en Vercel

¡Listo para producción! 🚀
