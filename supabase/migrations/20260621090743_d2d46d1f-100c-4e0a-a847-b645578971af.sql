
ALTER TABLE public.finance_incomes ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.finance_expenses ADD COLUMN IF NOT EXISTS import_batch_id uuid;
CREATE INDEX IF NOT EXISTS idx_finance_incomes_import_batch ON public.finance_incomes(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_expenses_import_batch ON public.finance_expenses(import_batch_id) WHERE import_batch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.finance_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type text NOT NULL,
  file_name text NOT NULL,
  sheet_name text,
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  skipped_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  duplicate_rows integer NOT NULL DEFAULT 0,
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  summary_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.finance_import_logs TO authenticated;
GRANT ALL ON public.finance_import_logs TO service_role;

ALTER TABLE public.finance_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_import_logs_select"
  ON public.finance_import_logs FOR SELECT
  TO authenticated
  USING (private.has_any_finance_role(auth.uid()));

CREATE POLICY "finance_import_logs_insert"
  ON public.finance_import_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'finance_manage'::public.app_role)
  );

CREATE INDEX IF NOT EXISTS idx_finance_import_logs_created_at ON public.finance_import_logs(created_at DESC);
