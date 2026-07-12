
-- Consolidate finance-attachments storage policies: drop duplicate fin_storage_* set
DROP POLICY IF EXISTS "fin_storage_read" ON storage.objects;
DROP POLICY IF EXISTS "fin_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "fin_storage_delete" ON storage.objects;

-- Restrict uploads to public media bucket to admin/staff only
DROP POLICY IF EXISTS "Authenticated upload media" ON storage.objects;
CREATE POLICY "Staff upload media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media'
  AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'staff'::app_role)
  )
);
