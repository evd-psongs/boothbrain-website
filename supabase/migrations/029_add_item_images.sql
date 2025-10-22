-- Add support for storing up to two reference images per item
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS image_paths TEXT[] DEFAULT '{}'::TEXT[];

ALTER TABLE public.items
  ALTER COLUMN image_paths SET DEFAULT '{}'::TEXT[];

ALTER TABLE public.items
  DROP COLUMN IF EXISTS image_urls;
