
ALTER TABLE public.finance_attachments ALTER COLUMN related_id DROP NOT NULL;
ALTER TABLE public.finance_attachments
  ADD CONSTRAINT finance_attachments_related_key_present
  CHECK (related_id IS NOT NULL OR related_bigint_id IS NOT NULL);
