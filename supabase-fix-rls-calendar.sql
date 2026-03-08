DROP POLICY IF EXISTS "Service role full access" ON public.calendar_events;

CREATE POLICY "Service role only" ON public.calendar_events
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
