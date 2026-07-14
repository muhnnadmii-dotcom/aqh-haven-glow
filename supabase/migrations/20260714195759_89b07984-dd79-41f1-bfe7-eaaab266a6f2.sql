
-- Recompute a single invoice's settlement_status based on its links.
CREATE OR REPLACE FUNCTION public.recompute_sales_invoice_settlement_status(p_invoice_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_provider text;
  v_current public.sales_invoice_settlement_status;
  v_new public.sales_invoice_settlement_status;
  v_has_active_link boolean;
BEGIN
  IF p_invoice_id IS NULL THEN
    RETURN;
  END IF;

  SELECT true, si.payment_provider::text, si.settlement_status
    INTO v_exists, v_provider, v_current
  FROM public.sales_invoices si
  WHERE si.id = p_invoice_id;

  IF NOT COALESCE(v_exists, false) THEN
    RETURN;
  END IF;

  IF v_provider = 'bank_transfer' THEN
    v_new := 'not_applicable';
  ELSIF v_provider IS NULL THEN
    v_new := 'manual_review';
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.payment_settlement_lines psl
      JOIN public.payment_settlements ps ON ps.id = psl.settlement_id
      WHERE psl.sales_invoice_id = p_invoice_id
        AND ps.status::text <> 'cancelled'
    ) INTO v_has_active_link;

    IF v_has_active_link THEN
      v_new := 'matched';
    ELSE
      v_new := 'pending';
    END IF;
  END IF;

  IF v_new IS DISTINCT FROM v_current THEN
    UPDATE public.sales_invoices
       SET settlement_status = v_new
     WHERE id = p_invoice_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_sales_invoice_settlement_status(bigint) FROM PUBLIC;

-- Trigger on payment_settlement_lines
CREATE OR REPLACE FUNCTION public._psl_recompute_invoice_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old bigint;
  v_new bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := OLD.sales_invoice_id;
    v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := NEW.sales_invoice_id;
  ELSE
    v_old := OLD.sales_invoice_id;
    v_new := NEW.sales_invoice_id;
  END IF;

  IF v_old IS NOT NULL THEN
    PERFORM public.recompute_sales_invoice_settlement_status(v_old);
  END IF;
  IF v_new IS NOT NULL AND v_new IS DISTINCT FROM v_old THEN
    PERFORM public.recompute_sales_invoice_settlement_status(v_new);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_psl_sync_invoice_settlement_iu ON public.payment_settlement_lines;
CREATE TRIGGER trg_psl_sync_invoice_settlement_iu
AFTER INSERT OR UPDATE OF sales_invoice_id, settlement_id
ON public.payment_settlement_lines
FOR EACH ROW EXECUTE FUNCTION public._psl_recompute_invoice_settlement();

DROP TRIGGER IF EXISTS trg_psl_sync_invoice_settlement_d ON public.payment_settlement_lines;
CREATE TRIGGER trg_psl_sync_invoice_settlement_d
AFTER DELETE
ON public.payment_settlement_lines
FOR EACH ROW EXECUTE FUNCTION public._psl_recompute_invoice_settlement();

-- Trigger on payment_settlements status change
CREATE OR REPLACE FUNCTION public._ps_status_recompute_invoices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    FOR v_id IN
      SELECT DISTINCT sales_invoice_id
      FROM public.payment_settlement_lines
      WHERE settlement_id = NEW.id
        AND sales_invoice_id IS NOT NULL
    LOOP
      PERFORM public.recompute_sales_invoice_settlement_status(v_id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ps_status_sync_invoice_settlement ON public.payment_settlements;
CREATE TRIGGER trg_ps_status_sync_invoice_settlement
AFTER UPDATE OF status
ON public.payment_settlements
FOR EACH ROW EXECUTE FUNCTION public._ps_status_recompute_invoices();

-- One-time backfill for all existing invoices
DO $$
DECLARE
  v_id bigint;
BEGIN
  FOR v_id IN SELECT id FROM public.sales_invoices LOOP
    PERFORM public.recompute_sales_invoice_settlement_status(v_id);
  END LOOP;
END;
$$;
