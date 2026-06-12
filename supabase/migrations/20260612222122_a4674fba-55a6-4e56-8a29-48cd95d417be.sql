
-- 1) Restrict storage media uploads
DROP POLICY IF EXISTS "Authenticated upload media" ON storage.objects;
CREATE POLICY "Authenticated upload media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'staff'::public.app_role)
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- 2) Prevent users from modifying sensitive appointment fields
CREATE OR REPLACE FUNCTION public.appointments_guard_sensitive_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'staff'::public.app_role) THEN
    RETURN NEW;
  END IF;
  NEW.status := OLD.status;
  NEW.admin_notes := OLD.admin_notes;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_guard_sensitive_fields ON public.appointments;
CREATE TRIGGER appointments_guard_sensitive_fields
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointments_guard_sensitive_fields();
