
-- Add new settlement line types for accurate classification
ALTER TYPE public.payment_settlement_line_type ADD VALUE IF NOT EXISTS 'chargeback';
ALTER TYPE public.payment_settlement_line_type ADD VALUE IF NOT EXISTS 'manual_adjustment';
ALTER TYPE public.payment_settlement_line_type ADD VALUE IF NOT EXISTS 'unexplained_deduction';

-- Add classification metadata columns on settlement lines
ALTER TABLE public.payment_settlement_lines
  ADD COLUMN IF NOT EXISTS classification_reason text,
  ADD COLUMN IF NOT EXISTS classification_note text,
  ADD COLUMN IF NOT EXISTS classified_at timestamptz,
  ADD COLUMN IF NOT EXISTS classified_by uuid;

-- Suspense account for unexplained differences and pending settlement lines
INSERT INTO public.chart_of_accounts (code, name_ar, name_en, account_type, account_subtype, is_system, is_active, allow_manual_entries, system_key, notes)
VALUES ('2810', 'فروقات وتسويات معلقة', 'Pending Differences and Settlements', 'liability', 'current_liability', true, true, true, 'settlement_suspense', 'حساب مؤقت لسطور التسويات غير المصنفة، يُنقل للحساب الصحيح عند التصنيف')
ON CONFLICT (code) DO NOTHING;
