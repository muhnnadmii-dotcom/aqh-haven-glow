-- 1) Enforce non-deductible VAT for invoices from non VAT-registered suppliers (idempotent trigger fn)
CREATE OR REPLACE FUNCTION public.apply_purchase_supplier_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_registered boolean;
BEGIN
  IF NEW.supplier_id IS NOT NULL THEN
    SELECT is_vat_registered INTO v_registered FROM public.finance_suppliers WHERE id = NEW.supplier_id;
    IF v_registered = false THEN
      NEW.attachment_required := false;
      -- Force VAT non-deductible: supplier is not VAT-registered so we cannot claim input VAT.
      -- Do NOT touch subtotal / vat_amount / total_amount / line items.
      NEW.deductible_percentage     := 0;
      NEW.deductible_vat_amount     := 0;
      NEW.non_deductible_vat_amount := COALESCE(NEW.vat_amount, 0);
      NEW.vat_deductibility         := 'non_deductible'::purchase_vat_deductibility;
      IF NEW.non_deductible_reason IS NULL THEN
        NEW.non_deductible_reason := 'missing_tax_invoice'::purchase_non_deductible_reason;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- 2) One-time idempotent fix for PUR-2026-0004 (STC PAY): flip deductible → non-deductible.
--    Guard: only if supplier is non VAT-registered AND figures still match the described state.
DO $$
DECLARE v_id bigint; v_old_ded numeric; v_old_nonded numeric; v_vat numeric;
BEGIN
  SELECT pi.id, pi.deductible_vat_amount, pi.non_deductible_vat_amount, pi.vat_amount
    INTO v_id, v_old_ded, v_old_nonded, v_vat
  FROM public.purchase_invoices pi
  JOIN public.finance_suppliers fs ON fs.id = pi.supplier_id
  WHERE pi.internal_reference = 'PUR-2026-0004'
    AND fs.is_vat_registered = false
    AND pi.deductible_vat_amount > 0;

  IF v_id IS NOT NULL THEN
    UPDATE public.purchase_invoices
       SET deductible_percentage      = 0,
           deductible_vat_amount      = 0,
           non_deductible_vat_amount  = COALESCE(vat_amount, 0),
           vat_deductibility          = 'non_deductible'::purchase_vat_deductibility,
           non_deductible_reason      = COALESCE(non_deductible_reason, 'missing_tax_invoice'::purchase_non_deductible_reason)
     WHERE id = v_id;

    INSERT INTO public.finance_audit_logs (related_type, related_bigint_id, action, field_name, old_value, new_value, note)
    VALUES
      ('purchase_invoice', v_id, 'vat_deductibility_fix', 'deductible_vat_amount',
       v_old_ded::text, '0.00',
       'Auto-correction: supplier غير مسجل ضريبيًا — لا تُخصم ضريبة المدخلات.'),
      ('purchase_invoice', v_id, 'vat_deductibility_fix', 'non_deductible_vat_amount',
       v_old_nonded::text, COALESCE(v_vat,0)::text,
       'Auto-correction: تحويل الضريبة إلى غير قابلة للخصم.');
  END IF;
END $$;
