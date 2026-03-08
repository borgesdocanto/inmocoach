-- Corregir RLS en todas las tablas con política permisiva
DO $$
DECLARE
  tbls TEXT[] := ARRAY['subscriptions','teams','team_invitations','team_invitations','calendar_events','coach_reports','payments'];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Service role only" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Service role only" ON public.%I
       USING (auth.role() = ''service_role'')
       WITH CHECK (auth.role() = ''service_role'')',
      t
    );
  END LOOP;
END $$;
