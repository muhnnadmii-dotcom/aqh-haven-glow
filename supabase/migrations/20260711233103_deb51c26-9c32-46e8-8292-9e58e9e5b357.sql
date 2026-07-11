
-- Add wallet_top_up line type
ALTER TYPE payment_settlement_line_type ADD VALUE IF NOT EXISTS 'wallet_top_up';

-- Add expected net amount tracking columns
ALTER TABLE public.payment_settlements
  ADD COLUMN IF NOT EXISTS source_expected_net_amount numeric,
  ADD COLUMN IF NOT EXISTS calculated_expected_net_amount numeric,
  ADD COLUMN IF NOT EXISTS wallet_top_up_amount numeric NOT NULL DEFAULT 0;

-- Create Salla wallet balance account (current asset, not a bank)
INSERT INTO public.chart_of_accounts (code, name_ar, name_en, account_type, account_subtype, is_system, is_active, allow_manual_entries, system_key, notes)
VALUES ('1740', 'رصيد محفظة سلة', 'Salla Wallet Balance', 'asset', 'current_asset', true, true, false, 'wallet_salla', 'رصيد محفظة سلة الداخلية — تحويل داخلي وليس حسابًا بنكيًا')
ON CONFLICT (code) DO NOTHING;
