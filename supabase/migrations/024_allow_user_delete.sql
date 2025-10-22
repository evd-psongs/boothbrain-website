-- Allow auth.users rows to be deleted via dashboard by relaxing profile-linked FKs
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_created_by_fkey,
  ADD CONSTRAINT organizations_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_invited_by_fkey,
  ADD CONSTRAINT organization_members_invited_by_fkey
    FOREIGN KEY (invited_by)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_created_by_fkey,
  ADD CONSTRAINT items_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_created_by_fkey,
  ADD CONSTRAINT orders_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
