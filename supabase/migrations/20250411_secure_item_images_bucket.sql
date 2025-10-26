-- 20250411_secure_item_images_bucket.sql
-- Make the item-images bucket private and ensure user-scoped storage policies remain in place.

update storage.buckets
set public = false
where id = 'item-images';

-- Recreate user-scoped policies so they survive on environments that still have the legacy versions.
drop policy if exists "Users can upload item images" on storage.objects;
create policy "Users can upload item images"
on storage.objects
for insert
with check (
  bucket_id = 'item-images'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "Users can manage item images" on storage.objects;
create policy "Users can manage item images"
on storage.objects
for all
using (
  bucket_id = 'item-images'
  and auth.uid()::text = split_part(name, '/', 1)
);

