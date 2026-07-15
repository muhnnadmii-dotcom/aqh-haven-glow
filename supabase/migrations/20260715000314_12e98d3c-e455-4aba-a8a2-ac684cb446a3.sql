-- Reverse existing draft JE for pre-quarter expense so the trigger can recreate it under the new rule
UPDATE public.journal_entries SET status='reversed'
 WHERE id='8457989b-d5f5-4fd9-9820-48b737bff93d' AND status<>'reversed';

-- Case A (pre-quarter, 2026-05-09) — expected: new JE posted
UPDATE public.finance_expenses SET updated_at=now()
 WHERE id='e909137b-36a9-414b-8380-c0a70d3a5dea';

-- Case B (current quarter, 2026-07-01) — expected: new JE draft
UPDATE public.finance_expenses SET updated_at=now()
 WHERE id='d9d1116c-8b38-4945-9ec5-96d43dd4c785';