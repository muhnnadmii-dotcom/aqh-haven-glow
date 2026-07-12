
CREATE OR REPLACE FUNCTION public.delete_settlement_full(
  _settlement_id uuid,
  _reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settlement RECORD;
  v_alloc RECORD;
  v_reversed_allocs int := 0;
  v_deleted_fee_links int := 0;
  v_deleted_lines int := 0;
  v_unlinked_incomes int := 0;
  v_unlinked_expenses int := 0;
BEGIN
  IF NOT (private.has_role(v_uid,'admin'::app_role) OR private.has_role(v_uid,'finance_manage'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  SELECT * INTO v_settlement FROM public.payment_settlements WHERE id=_settlement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'settlement_not_found'; END IF;

  -- 1) Reverse any active bank allocations
  FOR v_alloc IN
    SELECT id FROM public.settlement_bank_allocations
    WHERE settlement_id=_settlement_id AND status <> 'reversed'
  LOOP
    UPDATE public.settlement_bank_allocations
      SET status='reversed', reversed_at=now(), reversed_by=v_uid,
          reversal_reason = format('حذف التسوية: %s', _reason)
      WHERE id=v_alloc.id;
    v_reversed_allocs := v_reversed_allocs + 1;
  END LOOP;

  -- 2) Delete provider fee invoice links (soft link table)
  DELETE FROM public.provider_fee_invoice_settlements
    WHERE settlement_id=_settlement_id;
  GET DIAGNOSTICS v_deleted_fee_links = ROW_COUNT;

  -- 3) Unlink finance transactions that referenced this settlement (keep the rows)
  UPDATE public.finance_incomes SET settlement_id=NULL
    WHERE settlement_id=_settlement_id;
  GET DIAGNOSTICS v_unlinked_incomes = ROW_COUNT;

  UPDATE public.finance_expenses SET settlement_id=NULL
    WHERE settlement_id=_settlement_id;
  GET DIAGNOSTICS v_unlinked_expenses = ROW_COUNT;

  -- 4) Delete settlement lines
  DELETE FROM public.payment_settlement_lines WHERE settlement_id=_settlement_id;
  GET DIAGNOSTICS v_deleted_lines = ROW_COUNT;

  -- 5) Delete settlement row
  DELETE FROM public.payment_settlements WHERE id=_settlement_id;

  -- 6) Audit
  INSERT INTO public.finance_audit_logs(related_type, related_id, action, changed_by, note)
  VALUES ('settlement', _settlement_id, 'settlement_deleted', v_uid,
    format('reason=%s | reversed_allocs=%s deleted_lines=%s unlinked_incomes=%s unlinked_expenses=%s deleted_fee_links=%s ref=%s',
      _reason, v_reversed_allocs, v_deleted_lines, v_unlinked_incomes, v_unlinked_expenses, v_deleted_fee_links,
      COALESCE(v_settlement.settlement_reference,'-')));

  RETURN jsonb_build_object(
    'deleted', true,
    'reversed_allocations', v_reversed_allocs,
    'deleted_lines', v_deleted_lines,
    'unlinked_incomes', v_unlinked_incomes,
    'unlinked_expenses', v_unlinked_expenses,
    'deleted_fee_links', v_deleted_fee_links
  );
END $$;

REVOKE ALL ON FUNCTION public.delete_settlement_full(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_settlement_full(uuid,text) TO authenticated;
