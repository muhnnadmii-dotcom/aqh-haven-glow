
-- 1. vat_document_status enum
DO $$ BEGIN
  CREATE TYPE public.vat_document_status AS ENUM ('valid','missing','invalid_buyer_tax_data','pending_review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend purchase_invoices with provider-fee metadata (all nullable / safe defaults)
ALTER TABLE public.purchase_invoices
  ADD COLUMN IF NOT EXISTS payment_provider_id uuid REFERENCES public.payment_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_period_start date,
  ADD COLUMN IF NOT EXISTS fee_period_end date,
  ADD COLUMN IF NOT EXISTS provider_invoice_number text,
  ADD COLUMN IF NOT EXISTS vat_document_status public.vat_document_status,
  ADD COLUMN IF NOT EXISTS matched_fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS matched_vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unmatched_fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unmatched_vat_amount numeric(14,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_payment_provider ON public.purchase_invoices(payment_provider_id) WHERE payment_provider_id IS NOT NULL;

-- 3. Many-to-many linking table (fee invoice ↔ settlements)
CREATE TABLE IF NOT EXISTS public.provider_fee_invoice_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id bigint NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  settlement_id uuid NOT NULL REFERENCES public.payment_settlements(id) ON DELETE CASCADE,
  matched_fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  matched_vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(purchase_invoice_id, settlement_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_fee_invoice_settlements TO authenticated;
GRANT ALL ON public.provider_fee_invoice_settlements TO service_role;

ALTER TABLE public.provider_fee_invoice_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pfis_read" ON public.provider_fee_invoice_settlements
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_any_finance_role(auth.uid()));

CREATE POLICY "pfis_write" ON public.provider_fee_invoice_settlements
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'));

CREATE POLICY "pfis_update" ON public.provider_fee_invoice_settlements
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') OR private.has_role(auth.uid(),'finance_accountant'));

CREATE POLICY "pfis_delete" ON public.provider_fee_invoice_settlements
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));

CREATE INDEX IF NOT EXISTS idx_pfis_invoice ON public.provider_fee_invoice_settlements(purchase_invoice_id);
CREATE INDEX IF NOT EXISTS idx_pfis_settlement ON public.provider_fee_invoice_settlements(settlement_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.pfis_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.pfis_touch_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pfis_updated_at ON public.provider_fee_invoice_settlements;
CREATE TRIGGER trg_pfis_updated_at BEFORE UPDATE ON public.provider_fee_invoice_settlements
  FOR EACH ROW EXECUTE FUNCTION public.pfis_touch_updated_at();

-- 4. Recompute matched/unmatched on invoice from links + fee/vat totals
CREATE OR REPLACE FUNCTION public.recalc_provider_fee_invoice_matches(_invoice_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  m_fee numeric(14,2) := 0;
  m_vat numeric(14,2) := 0;
  total_fee numeric(14,2) := 0;
  total_vat numeric(14,2) := 0;
BEGIN
  SELECT COALESCE(SUM(matched_fee_amount),0), COALESCE(SUM(matched_vat_amount),0)
    INTO m_fee, m_vat
    FROM public.provider_fee_invoice_settlements
    WHERE purchase_invoice_id = _invoice_id;

  SELECT COALESCE(SUM(line_subtotal),0), COALESCE(SUM(line_tax_amount),0)
    INTO total_fee, total_vat
    FROM public.purchase_invoice_items
    WHERE purchase_invoice_id = _invoice_id;

  UPDATE public.purchase_invoices
     SET matched_fee_amount = m_fee,
         matched_vat_amount = m_vat,
         unmatched_fee_amount = GREATEST(total_fee - m_fee, 0),
         unmatched_vat_amount = GREATEST(total_vat - m_vat, 0)
   WHERE id = _invoice_id;
END $$;
REVOKE ALL ON FUNCTION public.recalc_provider_fee_invoice_matches(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalc_provider_fee_invoice_matches(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.pfis_after_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_provider_fee_invoice_matches(OLD.purchase_invoice_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_provider_fee_invoice_matches(NEW.purchase_invoice_id);
    IF TG_OP = 'UPDATE' AND OLD.purchase_invoice_id <> NEW.purchase_invoice_id THEN
      PERFORM public.recalc_provider_fee_invoice_matches(OLD.purchase_invoice_id);
    END IF;
    RETURN NEW;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.pfis_after_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pfis_after_change ON public.provider_fee_invoice_settlements;
CREATE TRIGGER trg_pfis_after_change AFTER INSERT OR UPDATE OR DELETE ON public.provider_fee_invoice_settlements
  FOR EACH ROW EXECUTE FUNCTION public.pfis_after_change();

-- Recompute unmatched when invoice items change (fees only recomputed if provider linked)
CREATE OR REPLACE FUNCTION public.purchase_invoice_items_recalc_matches()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _inv bigint;
BEGIN
  _inv := COALESCE(NEW.purchase_invoice_id, OLD.purchase_invoice_id);
  IF EXISTS (SELECT 1 FROM public.purchase_invoices WHERE id = _inv AND payment_provider_id IS NOT NULL) THEN
    PERFORM public.recalc_provider_fee_invoice_matches(_inv);
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE ALL ON FUNCTION public.purchase_invoice_items_recalc_matches() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pii_recalc_matches ON public.purchase_invoice_items;
CREATE TRIGGER trg_pii_recalc_matches AFTER INSERT OR UPDATE OR DELETE ON public.purchase_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.purchase_invoice_items_recalc_matches();

COMMENT ON COLUMN public.purchase_invoices.payment_provider_id IS 'إن كانت هذه فاتورة رسوم شهرية من بوابة دفع (سلة/تابي/تمارا) — تربط الفاتورة بالبوابة.';
COMMENT ON COLUMN public.purchase_invoices.vat_document_status IS 'حالة المستند الضريبي: valid / missing / invalid_buyer_tax_data / pending_review. عند invalid_buyer_tax_data لا تخصم الضريبة تلقائيًا.';
COMMENT ON TABLE public.provider_fee_invoice_settlements IS 'ربط M:N بين فاتورة رسوم البوابة والتسويات التي غطتها — يمنع تكرار احتساب الرسوم.';
