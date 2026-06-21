-- Storage policies for private finance-attachments bucket
CREATE POLICY "fin_storage_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'finance-attachments' AND private.has_any_finance_role(auth.uid()));

CREATE POLICY "fin_storage_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'finance-attachments'
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'finance_manage'::public.app_role)
  )
);

CREATE POLICY "fin_storage_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'finance-attachments'
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'finance_manage'::public.app_role)
  )
);