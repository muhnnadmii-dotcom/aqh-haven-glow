INSERT INTO public.finance_attachments (related_type, related_bigint_id, file_url, file_name, file_type, attachment_type, uploaded_by)
SELECT 'purchase_invoice', v.rid, v.url, v.fname, 'application/pdf', 'فاتورة', '332f6cf3-a551-4aa9-b022-a30ab8902731'::uuid
FROM (VALUES
  (380::bigint, 'purchase_invoice/380/1787400000001_Tabby_2026-07-10_CFKSA-INV-001156585_SAR937.46.pdf', 'Tabby_2026-07-10_CFKSA-INV-001156585_SAR937.46.pdf'),
  (382::bigint, 'purchase_invoice/382/1787400000002_Tabby_2026-07-31_INV-M-KSA-10016_SAR933.62.pdf', 'Tabby_2026-07-31_INV-M-KSA-10016_SAR933.62.pdf')
) AS v(rid, url, fname)
WHERE NOT EXISTS (
  SELECT 1 FROM public.finance_attachments a
  WHERE a.related_type='purchase_invoice' AND a.related_bigint_id = v.rid AND a.file_url = v.url
);

UPDATE public.purchase_invoices SET vat_document_status='valid' WHERE id IN (125,380,382);

DO $do$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub','332f6cf3-a551-4aa9-b022-a30ab8902731','role','authenticated','aal','aal2')::text, true);
  PERFORM public.approve_purchase_invoice(380);
  PERFORM public.approve_purchase_invoice(382);
  PERFORM set_config('request.jwt.claims', NULL, true);
END
$do$;