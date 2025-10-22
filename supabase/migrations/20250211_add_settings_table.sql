-- Settings table for app configuration values
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Ensure updated_at stays in sync
DROP TRIGGER IF EXISTS update_settings_updated_at ON public.settings;

CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime updates
DO $$
BEGIN
  PERFORM 1
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'settings';

  IF NOT FOUND THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
  END IF;
END$$;

-- Enable Row Level Security
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Development policies (adjust for production)
CREATE POLICY "Settings readable by everyone"
  ON public.settings FOR SELECT USING (true);
-- policy adjustments continue below

CREATE POLICY "Settings insertable by everyone"
  ON public.settings FOR INSERT WITH CHECK (true);

CREATE POLICY "Settings updatable by everyone"
  ON public.settings FOR UPDATE USING (true);
