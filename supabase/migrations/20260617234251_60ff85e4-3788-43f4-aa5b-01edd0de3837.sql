-- Add new statuses for design proposals
ALTER TYPE public.service_request_status ADD VALUE IF NOT EXISTS 'proposal_sent';
ALTER TYPE public.service_request_status ADD VALUE IF NOT EXISTS 'approved';

-- Allow anonymous visitors to submit a service request (guest submissions).
-- Mirrors the policy already in place on contact_requests.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='service_requests'
      AND policyname='Visitors submit service requests'
  ) THEN
    CREATE POLICY "Visitors submit service requests"
      ON public.service_requests
      FOR INSERT
      TO anon
      WITH CHECK (user_id IS NULL);
  END IF;
END$$;

GRANT INSERT ON public.service_requests TO anon;