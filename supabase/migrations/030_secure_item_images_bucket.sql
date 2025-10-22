-- Ensure the item-images bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Reset existing policies for the bucket
DROP POLICY IF EXISTS "Org members can upload item images" ON storage.objects;
DROP POLICY IF EXISTS "Org members can remove item images" ON storage.objects;

-- Helper expression to extract the organization UUID from the object path
-- Names are structured as: <organization_id>/<filename>

CREATE POLICY "Org members can upload item images" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'item-images'
    AND name ~ '^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}/'
    AND public.is_organization_member(
      (substring(name from '^([0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12})'))::uuid,
      auth.uid()
    )
  );

CREATE POLICY "Org members can remove item images" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'item-images'
    AND name ~ '^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}/'
    AND public.is_organization_member(
      (substring(name from '^([0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12})'))::uuid,
      auth.uid()
    )
  );
