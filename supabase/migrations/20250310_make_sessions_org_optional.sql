-- Allow sessions to be created without legacy organization references.
ALTER TABLE public.sessions
  ALTER COLUMN organization_id DROP NOT NULL;

-- Optional: future cleanup will fully remove organization_id.
