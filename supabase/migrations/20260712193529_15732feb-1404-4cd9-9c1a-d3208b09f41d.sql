
-- Add "partial_refund" line type used by Tabby merchant statements.
-- No new tables, no changes to existing data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'payment_settlement_line_type' AND e.enumlabel = 'partial_refund'
  ) THEN
    ALTER TYPE public.payment_settlement_line_type ADD VALUE 'partial_refund';
  END IF;
END $$;
