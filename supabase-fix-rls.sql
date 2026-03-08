-- Eliminar política permisiva anterior
DROP POLICY IF EXISTS "Service role full access" ON public.team_invitations;

-- Política correcta: solo el service role puede hacer todo
CREATE POLICY "Service role only" ON public.team_invitations
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
