
-- Enums
DO $$ BEGIN
  CREATE TYPE public.sales_channel_type AS ENUM ('manual','salla','direct','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sales_payment_provider AS ENUM (
    'salla_payments','tabby','tamara','bank_transfer','personal_account','business_account','cash','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sales_data_completeness AS ENUM (
    'complete','missing_original_invoice','missing_tax_details','needs_review','needs_credit_note'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- sales_import_batches
CREATE TABLE IF NOT EXISTS public.sales_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_channel public.sales_channel_type NOT NULL DEFAULT 'salla',
  file_name text NOT NULL,
  sheet_name text,
  mapping_name text,
  mapping_snapshot jsonb,
  total_rows int NOT NULL DEFAULT 0,
  imported_rows int NOT NULL DEFAULT 0,
  duplicate_rows int NOT NULL DEFAULT 0,
  needs_review_rows int NOT NULL DEFAULT 0,
  error_rows int NOT NULL DEFAULT 0,
  summary_json jsonb,
  notes text,
  status text NOT NULL DEFAULT 'committed',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_import_batches_status_chk CHECK (status IN ('preview','committed','archived','failed'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_import_batches TO authenticated;
GRANT ALL ON public.sales_import_batches TO service_role;
ALTER TABLE public.sales_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY sib_select ON public.sales_import_batches FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
CREATE POLICY sib_insert ON public.sales_import_batches FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'));
CREATE POLICY sib_update ON public.sales_import_batches FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));
CREATE POLICY sib_delete ON public.sales_import_batches FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER sib_touch BEFORE UPDATE ON public.sales_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- sales_import_mappings (reusable column-map templates)
CREATE TABLE IF NOT EXISTS public.sales_import_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sales_channel public.sales_channel_type NOT NULL DEFAULT 'salla',
  mapping jsonb NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sales_channel, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_import_mappings TO authenticated;
GRANT ALL ON public.sales_import_mappings TO service_role;
ALTER TABLE public.sales_import_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY sim_select ON public.sales_import_mappings FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
CREATE POLICY sim_write ON public.sales_import_mappings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'));
CREATE TRIGGER sim_touch BEFORE UPDATE ON public.sales_import_mappings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Extend sales_invoices with channel / external / totals-tracking columns (all nullable / safe defaults)
ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS sales_channel public.sales_channel_type NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS payment_provider public.sales_payment_provider,
  ADD COLUMN IF NOT EXISTS external_order_id text,
  ADD COLUMN IF NOT EXISTS external_invoice_number text,
  ADD COLUMN IF NOT EXISTS order_date date,
  ADD COLUMN IF NOT EXISTS order_status text,
  ADD COLUMN IF NOT EXISTS original_gross_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS refund_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS shipping_before_vat numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_vat numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_name_snapshot text,
  ADD COLUMN IF NOT EXISTS data_completeness_status public.sales_data_completeness NOT NULL DEFAULT 'complete',
  ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES public.sales_import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_row_snapshot jsonb;

-- Prevent duplicate external orders per channel (allows manual invoices with NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_invoices_channel_external_order
  ON public.sales_invoices (sales_channel, external_order_id)
  WHERE external_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_invoices_channel ON public.sales_invoices (sales_channel);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_completeness ON public.sales_invoices (data_completeness_status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_import_batch ON public.sales_invoices (import_batch_id);

-- sales_refunds: keep refunds independent of the original invoice
CREATE TABLE IF NOT EXISTS public.sales_refunds (
  id bigserial PRIMARY KEY,
  invoice_id bigint NOT NULL REFERENCES public.sales_invoices(id) ON DELETE RESTRICT,
  refund_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL,
  reason text,
  external_reference text,
  sales_channel public.sales_channel_type NOT NULL DEFAULT 'manual',
  has_credit_note boolean NOT NULL DEFAULT false,
  credit_note_id bigint REFERENCES public.credit_debit_notes(id) ON DELETE SET NULL,
  import_batch_id uuid REFERENCES public.sales_import_batches(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_refunds_invoice ON public.sales_refunds (invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_refunds_batch ON public.sales_refunds (import_batch_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_refunds TO authenticated;
GRANT ALL ON public.sales_refunds TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sales_refunds_id_seq TO authenticated;
ALTER TABLE public.sales_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY sr_select ON public.sales_refunds FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
CREATE POLICY sr_insert ON public.sales_refunds FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'));
CREATE POLICY sr_update ON public.sales_refunds FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'));
CREATE POLICY sr_delete ON public.sales_refunds FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));

CREATE TRIGGER sr_touch BEFORE UPDATE ON public.sales_refunds
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Keep sales_invoices.refund_amount in sync with sum(sales_refunds.amount)
CREATE OR REPLACE FUNCTION public.sales_refunds_recalc(p_invoice_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total numeric(14,2);
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO v_total FROM public.sales_refunds WHERE invoice_id = p_invoice_id;
  UPDATE public.sales_invoices
     SET refund_amount = v_total,
         net_amount = COALESCE(original_gross_amount, total_amount) - v_total
   WHERE id = p_invoice_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.sales_refunds_recalc(bigint) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sales_refunds_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    PERFORM public.sales_refunds_recalc(OLD.invoice_id);
    RETURN OLD;
  ELSE
    PERFORM public.sales_refunds_recalc(NEW.invoice_id);
    IF TG_OP='UPDATE' AND NEW.invoice_id <> OLD.invoice_id THEN
      PERFORM public.sales_refunds_recalc(OLD.invoice_id);
    END IF;
    RETURN NEW;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.sales_refunds_after_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sales_refunds_after_change ON public.sales_refunds;
CREATE TRIGGER trg_sales_refunds_after_change
AFTER INSERT OR UPDATE OR DELETE ON public.sales_refunds
FOR EACH ROW EXECUTE FUNCTION public.sales_refunds_after_change();

-- Backfill net_amount for existing rows only where currently NULL (safe: no data changed)
UPDATE public.sales_invoices
   SET net_amount = COALESCE(original_gross_amount, total_amount) - COALESCE(refund_amount,0)
 WHERE net_amount IS NULL;
