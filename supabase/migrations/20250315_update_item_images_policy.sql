-- Align storage policies with user-scoped inventory (no organizations).

-- Remove legacy organization-based policies if they still exist.
DROP POLICY IF EXISTS "Org members can upload item images" ON storage.objects;
DROP POLICY IF EXISTS "Org members can remove item images" ON storage.objects;

-- Allow each user to manage files within their own user-id namespace.
CREATE POLICY "Users can upload item images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'item-images'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can manage item images"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'item-images'
  AND auth.uid()::text = split_part(name, '/', 1)
);
