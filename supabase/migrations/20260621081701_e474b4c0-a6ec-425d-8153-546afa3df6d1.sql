
CREATE POLICY "fin_obj_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'finance-attachments' AND private.has_any_finance_role(auth.uid()));
CREATE POLICY "fin_obj_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'finance-attachments' AND (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage')));
CREATE POLICY "fin_obj_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'finance-attachments' AND (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage')));
