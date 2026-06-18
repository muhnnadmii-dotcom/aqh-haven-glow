
ALTER TABLE public.aquarium_issues DROP CONSTRAINT IF EXISTS aquarium_issues_status_check;
ALTER TABLE public.aquarium_issues ADD CONSTRAINT aquarium_issues_status_check
  CHECK (status = ANY (ARRAY['open'::text, 'in_review'::text, 'resolved'::text, 'closed'::text]));

ALTER TABLE public.aquarium_issues
  ADD COLUMN IF NOT EXISTS service_request_id uuid REFERENCES public.service_requests(id) ON DELETE SET NULL;

CREATE POLICY "Admin staff update tank issues"
  ON public.aquarium_issues FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'staff'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'staff'::public.app_role));
