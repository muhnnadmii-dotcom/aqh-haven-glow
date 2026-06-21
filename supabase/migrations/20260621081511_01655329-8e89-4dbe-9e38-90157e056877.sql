
-- ============ 1) Roles ============
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_view';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_manage';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_accountant';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_export';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_settings';
