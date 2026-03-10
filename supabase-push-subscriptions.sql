CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL REFERENCES public.subscriptions(email) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own push subs" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Service role all push subs" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subs" ON public.push_subscriptions
  FOR ALL USING (auth.uid()::text = email);
CREATE POLICY "Service role all push subs" ON public.push_subscriptions
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_push_email ON public.push_subscriptions(email);
