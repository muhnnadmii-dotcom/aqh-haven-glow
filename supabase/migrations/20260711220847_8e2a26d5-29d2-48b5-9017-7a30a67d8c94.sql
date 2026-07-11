
CREATE TABLE IF NOT EXISTS public.salla_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_order_id TEXT NOT NULL UNIQUE,
  order_status TEXT,
  payment_status TEXT,
  original_total NUMERIC(14,2),
  refund_total NUMERIC(14,2) DEFAULT 0,
  payment_method TEXT,
  invoice_number TEXT,
  cancellation_date DATE,
  order_date DATE,
  customer_name TEXT,
  batch_id UUID,
  raw_snapshot JSONB,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salla_orders_status ON public.salla_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_salla_orders_batch ON public.salla_orders(batch_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salla_orders TO authenticated;
GRANT ALL ON public.salla_orders TO service_role;

ALTER TABLE public.salla_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salla_orders_select_finance"
  ON public.salla_orders FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_any_finance_role(auth.uid()));

CREATE POLICY "salla_orders_write_finance"
  ON public.salla_orders FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finance_manage'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finance_manage'::app_role));

CREATE OR REPLACE FUNCTION public.salla_orders_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_salla_orders_touch
  BEFORE UPDATE ON public.salla_orders
  FOR EACH ROW EXECUTE FUNCTION public.salla_orders_touch_updated_at();

-- Backfill from existing Salla invoices (non-cancelled orders already imported)
INSERT INTO public.salla_orders (
  external_order_id, order_status, payment_status, original_total, refund_total,
  payment_method, invoice_number, order_date, customer_name, batch_id, raw_snapshot
)
SELECT
  si.external_order_id::text,
  COALESCE(si.order_status, 'imported'),
  si.payment_status,
  si.original_gross_amount,
  COALESCE(si.refund_amount, 0),
  si.original_payment_method,
  si.invoice_number,
  si.order_date,
  si.customer_name_snapshot,
  si.import_batch_id,
  si.import_row_snapshot
FROM public.sales_invoices si
WHERE si.sales_channel = 'salla' AND si.external_order_id IS NOT NULL
ON CONFLICT (external_order_id) DO NOTHING;
