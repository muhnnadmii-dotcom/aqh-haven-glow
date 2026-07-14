
CREATE OR REPLACE FUNCTION public.finance_expenses_backfill_link(
  p_limit int DEFAULT 30,
  p_only_supplier_kind text DEFAULT NULL
) RETURNS TABLE(
  expense_id uuid, expense_date date, amount numeric, supplier_id uuid,
  supplier_vat_registered boolean, transaction_type finance_outgoing_type,
  action text, purchase_invoice_id bigint,
  invoice_subtotal numeric, invoice_vat numeric, invoice_total numeric
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private
AS $fn$
DECLARE r record; v_pi bigint; v_before bigint; v_action text;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR r IN
    SELECT e.id, e.expense_date, e.amount, e.supplier_id, e.transaction_type,
           coalesce(s.is_vat_registered,false) AS is_vat
      FROM public.finance_expenses e
      LEFT JOIN public.finance_suppliers s ON s.id = e.supplier_id
     WHERE e.deleted_at IS NULL
       AND e.accounting_status = 'classified'
       AND e.transaction_type IN ('supplier_invoice_payment','inventory_purchase',
                                  'direct_operating_expense','asset_purchase')
       AND e.purchase_invoice_id IS NULL
       AND (
         p_only_supplier_kind IS NULL
         OR (p_only_supplier_kind='vat'         AND s.is_vat_registered = true)
         OR (p_only_supplier_kind='non_vat'     AND e.supplier_id IS NOT NULL AND coalesce(s.is_vat_registered,false)=false)
         OR (p_only_supplier_kind='no_supplier' AND e.supplier_id IS NULL)
       )
     ORDER BY e.expense_date DESC, e.id
     LIMIT p_limit
  LOOP
    SELECT coalesce(max(id),0) INTO v_before FROM public.purchase_invoices;
    v_pi := private.finance_expense_link_pi(r.id);
    IF v_pi IS NULL THEN v_action := 'skipped';
    ELSIF v_pi > v_before THEN v_action := 'created';
    ELSE v_action := 'matched_existing';
    END IF;
    expense_id := r.id; expense_date := r.expense_date; amount := r.amount;
    supplier_id := r.supplier_id; supplier_vat_registered := r.is_vat;
    transaction_type := r.transaction_type; action := v_action;
    purchase_invoice_id := v_pi;
    IF v_pi IS NOT NULL THEN
      SELECT pi.subtotal, pi.vat_amount, pi.total_amount
        INTO invoice_subtotal, invoice_vat, invoice_total
        FROM public.purchase_invoices pi WHERE pi.id = v_pi;
    ELSE
      invoice_subtotal := NULL; invoice_vat := NULL; invoice_total := NULL;
    END IF;
    RETURN NEXT;
  END LOOP;
END $fn$;
