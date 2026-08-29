-- Tabla de perfiles públicos de agentes
-- Cada agente puede personalizar su landing card: foto, bio, contacto, redes sociales
CREATE TABLE IF NOT EXISTS public.agent_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE REFERENCES public.subscriptions(email) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Datos personales
  photo_url text,                    -- URL de foto (Tokko o upload a Supabase Storage)
  bio text DEFAULT '',               -- Bio/presentación corta
  phone text DEFAULT '',             -- Teléfono contacto
  email_contact text,                -- Email para contactos (puede ser distinto)
  
  -- Redes sociales
  instagram_url text DEFAULT '',
  linkedin_url text DEFAULT '',
  whatsapp_link text DEFAULT '',     -- wa.me/549XXXXXXXXXXX
  
  -- URL pública
  slug text UNIQUE NOT NULL,         -- ej: "hernan-dinter" para /agents/hernan-dinter
  
  -- Control
  is_visible boolean DEFAULT true,   -- puede deshabilitar su landing
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_phone CHECK (phone ~ '^\d*$' OR phone = ''),
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9\-]+$')
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_agent_profiles_email ON public.agent_profiles(email);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_team_id ON public.agent_profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_slug ON public.agent_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_visible_team ON public.agent_profiles(is_visible, team_id);

-- Trigger para actualizar updated_at
CREATE TRIGGER agent_profiles_updated_at
  BEFORE UPDATE ON public.agent_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ROW LEVEL SECURITY
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Service role (backend) tiene acceso total
CREATE POLICY "Service role full access" ON public.agent_profiles
  USING (true) WITH CHECK (true);

-- Policy: El agente puede ver y editar su propio perfil
CREATE POLICY "Agents can view and edit own profile" ON public.agent_profiles
  FOR ALL USING (
    auth.uid()::text = (
      SELECT id::text FROM public.subscriptions WHERE email = auth.jwt()->>'email'
    )
    OR email = auth.jwt()->>'email'
  )
  WITH CHECK (
    email = auth.jwt()->>'email'
  );

-- Policy: Team leader puede ver y editar perfiles de su equipo
CREATE POLICY "Team leaders can manage their agents" ON public.agent_profiles
  FOR ALL USING (
    team_id IN (
      SELECT team_id FROM public.subscriptions 
      WHERE email = auth.jwt()->>'email' 
      AND team_role IN ('owner', 'team_leader')
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.subscriptions 
      WHERE email = auth.jwt()->>'email' 
      AND team_role IN ('owner', 'team_leader')
    )
  );

-- Policy: Público (sin autenticar) puede ver perfiles visibles
CREATE POLICY "Public can view visible profiles" ON public.agent_profiles
  FOR SELECT USING (is_visible = true);

-- Tabla auxiliar para auditar cambios de perfil (opcional, para fase 2)
CREATE TABLE IF NOT EXISTS public.agent_profile_edits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  editor_email text NOT NULL,
  changes jsonb NOT NULL,  -- {field: "bio", old_value: "...", new_value: "..."}
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_profile_edits_profile ON public.agent_profile_edits(profile_id);
CREATE INDEX IF NOT EXISTS idx_agent_profile_edits_editor ON public.agent_profile_edits(editor_email);
