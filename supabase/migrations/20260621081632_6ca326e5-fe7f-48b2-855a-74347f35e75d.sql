
-- ============ Enums ============
CREATE TYPE public.finance_account_type AS ENUM ('business', 'personal');
CREATE TYPE public.finance_internal_review AS ENUM ('unreviewed', 'reviewed');
CREATE TYPE public.finance_accountant_status AS ENUM ('not_reviewed', 'reviewed', 'posted_to_qoyod', 'needs_fix');
CREATE TYPE public.finance_attachment_status AS ENUM ('attached', 'not_attached', 'not_required');
CREATE TYPE public.finance_category_kind AS ENUM ('main', 'sub');
CREATE TYPE public.finance_related_type AS ENUM ('income', 'expense', 'supplier');

-- ============ Helper: any finance role ============
CREATE OR REPLACE FUNCTION private.has_any_finance_role(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('admin','finance_view','finance_manage','finance_accountant','finance_export','finance_settings')
  )
$$;

-- ============ touch_updated_at already exists ============

-- ============ income_sources ============
CREATE TABLE public.finance_income_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_income_sources TO authenticated;
GRANT ALL ON public.finance_income_sources TO service_role;
ALTER TABLE public.finance_income_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_sources_read" ON public.finance_income_sources FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
CREATE POLICY "fin_sources_write_admin" ON public.finance_income_sources FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_settings'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_settings'));
CREATE TRIGGER trg_fin_sources_updated BEFORE UPDATE ON public.finance_income_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ categories ============
CREATE TABLE public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.finance_category_kind NOT NULL,
  parent_id uuid REFERENCES public.finance_categories(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, parent_id),
  CHECK ((kind='main' AND parent_id IS NULL) OR (kind='sub' AND parent_id IS NOT NULL))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_categories TO authenticated;
GRANT ALL ON public.finance_categories TO service_role;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_cat_read" ON public.finance_categories FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
CREATE POLICY "fin_cat_write_admin" ON public.finance_categories FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_settings'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_settings'));
CREATE TRIGGER trg_fin_cat_updated BEFORE UPDATE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ suppliers ============
CREATE TABLE public.finance_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_name text,
  phone text,
  email text,
  city text,
  country text,
  supplier_type text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_suppliers TO authenticated;
GRANT ALL ON public.finance_suppliers TO service_role;
ALTER TABLE public.finance_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_sup_read" ON public.finance_suppliers FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
CREATE POLICY "fin_sup_write" ON public.finance_suppliers FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));
CREATE TRIGGER trg_fin_sup_updated BEFORE UPDATE ON public.finance_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ incomes ============
CREATE TABLE public.finance_incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  income_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  income_source_id uuid REFERENCES public.finance_income_sources(id) ON DELETE RESTRICT,
  month text NOT NULL,
  account_type public.finance_account_type NOT NULL DEFAULT 'business',
  note text,
  internal_review_status public.finance_internal_review NOT NULL DEFAULT 'unreviewed',
  accountant_status public.finance_accountant_status NOT NULL DEFAULT 'not_reviewed',
  accountant_note text,
  attachment_status public.finance_attachment_status NOT NULL DEFAULT 'not_attached',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fin_inc_date ON public.finance_incomes(income_date DESC);
CREATE INDEX idx_fin_inc_month ON public.finance_incomes(month);
GRANT SELECT, INSERT, DELETE ON public.finance_incomes TO authenticated;
GRANT UPDATE ON public.finance_incomes TO authenticated;
GRANT ALL ON public.finance_incomes TO service_role;
ALTER TABLE public.finance_incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_inc_read" ON public.finance_incomes FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
CREATE POLICY "fin_inc_insert" ON public.finance_incomes FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));
CREATE POLICY "fin_inc_delete" ON public.finance_incomes FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));
-- Manager full update
CREATE POLICY "fin_inc_update_manager" ON public.finance_incomes FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));
-- Accountant restricted update: enforced via trigger below
CREATE POLICY "fin_inc_update_accountant" ON public.finance_incomes FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'finance_accountant'))
  WITH CHECK (private.has_role(auth.uid(),'finance_accountant'));

-- ============ expenses ============
CREATE TABLE public.finance_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  item_name text NOT NULL,
  supplier_id uuid REFERENCES public.finance_suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  main_category_id uuid REFERENCES public.finance_categories(id) ON DELETE RESTRICT,
  sub_category_id uuid REFERENCES public.finance_categories(id) ON DELETE RESTRICT,
  month text NOT NULL,
  account_type public.finance_account_type NOT NULL DEFAULT 'business',
  note text,
  internal_review_status public.finance_internal_review NOT NULL DEFAULT 'unreviewed',
  accountant_status public.finance_accountant_status NOT NULL DEFAULT 'not_reviewed',
  accountant_note text,
  attachment_status public.finance_attachment_status NOT NULL DEFAULT 'not_attached',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fin_exp_date ON public.finance_expenses(expense_date DESC);
CREATE INDEX idx_fin_exp_month ON public.finance_expenses(month);
CREATE INDEX idx_fin_exp_supplier ON public.finance_expenses(supplier_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_expenses TO authenticated;
GRANT ALL ON public.finance_expenses TO service_role;
ALTER TABLE public.finance_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_exp_read" ON public.finance_expenses FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
CREATE POLICY "fin_exp_insert" ON public.finance_expenses FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));
CREATE POLICY "fin_exp_delete" ON public.finance_expenses FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));
CREATE POLICY "fin_exp_update_manager" ON public.finance_expenses FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));
CREATE POLICY "fin_exp_update_accountant" ON public.finance_expenses FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'finance_accountant'))
  WITH CHECK (private.has_role(auth.uid(),'finance_accountant'));

-- ============ attachments ============
CREATE TABLE public.finance_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  related_type public.finance_related_type NOT NULL,
  related_id uuid NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  attachment_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fin_att_related ON public.finance_attachments(related_type, related_id);
GRANT SELECT, INSERT, DELETE ON public.finance_attachments TO authenticated;
GRANT ALL ON public.finance_attachments TO service_role;
ALTER TABLE public.finance_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_att_read" ON public.finance_attachments FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
CREATE POLICY "fin_att_insert" ON public.finance_attachments FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));
CREATE POLICY "fin_att_delete" ON public.finance_attachments FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));

-- ============ audit logs (append-only) ============
CREATE TABLE public.finance_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  related_type text NOT NULL,
  related_id uuid,
  action text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);
CREATE INDEX idx_fin_audit_related ON public.finance_audit_logs(related_type, related_id);
CREATE INDEX idx_fin_audit_at ON public.finance_audit_logs(changed_at DESC);
GRANT SELECT ON public.finance_audit_logs TO authenticated;
GRANT ALL ON public.finance_audit_logs TO service_role;
ALTER TABLE public.finance_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_audit_read" ON public.finance_audit_logs FOR SELECT TO authenticated
  USING (private.has_any_finance_role(auth.uid()));
-- no INSERT/UPDATE/DELETE policies → only service_role (and triggers) can write

-- ============ Month auto-compute trigger ============
CREATE OR REPLACE FUNCTION public.finance_set_month()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'finance_incomes' THEN
    NEW.month := to_char(NEW.income_date, 'YYYY-MM');
  ELSIF TG_TABLE_NAME = 'finance_expenses' THEN
    NEW.month := to_char(NEW.expense_date, 'YYYY-MM');
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER trg_fin_inc_month BEFORE INSERT OR UPDATE OF income_date ON public.finance_incomes
  FOR EACH ROW EXECUTE FUNCTION public.finance_set_month();
CREATE TRIGGER trg_fin_exp_month BEFORE INSERT OR UPDATE OF expense_date ON public.finance_expenses
  FOR EACH ROW EXECUTE FUNCTION public.finance_set_month();

CREATE TRIGGER trg_fin_inc_updated BEFORE UPDATE ON public.finance_incomes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_fin_exp_updated BEFORE UPDATE ON public.finance_expenses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Accountant column-restriction trigger ============
CREATE OR REPLACE FUNCTION public.finance_accountant_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  -- If user is admin or manager, no restriction
  IF private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage') THEN
    RETURN NEW;
  END IF;
  -- Accountant: only allow editing main_category_id, sub_category_id, accountant_status, accountant_note
  IF private.has_role(auth.uid(),'finance_accountant') THEN
    IF TG_TABLE_NAME = 'finance_incomes' THEN
      NEW.income_date := OLD.income_date;
      NEW.amount := OLD.amount;
      NEW.account_type := OLD.account_type;
      NEW.income_source_id := OLD.income_source_id;
      NEW.note := OLD.note;
      NEW.attachment_status := OLD.attachment_status;
      NEW.created_by := OLD.created_by;
      NEW.internal_review_status := OLD.internal_review_status;
    ELSIF TG_TABLE_NAME = 'finance_expenses' THEN
      NEW.expense_date := OLD.expense_date;
      NEW.amount := OLD.amount;
      NEW.account_type := OLD.account_type;
      NEW.item_name := OLD.item_name;
      NEW.supplier_id := OLD.supplier_id;
      NEW.supplier_name := OLD.supplier_name;
      NEW.note := OLD.note;
      NEW.attachment_status := OLD.attachment_status;
      NEW.created_by := OLD.created_by;
      NEW.internal_review_status := OLD.internal_review_status;
    END IF;
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER trg_fin_inc_acct_guard BEFORE UPDATE ON public.finance_incomes
  FOR EACH ROW EXECUTE FUNCTION public.finance_accountant_guard();
CREATE TRIGGER trg_fin_exp_acct_guard BEFORE UPDATE ON public.finance_expenses
  FOR EACH ROW EXECUTE FUNCTION public.finance_accountant_guard();

-- ============ Attachment status auto-update ============
CREATE OR REPLACE FUNCTION public.finance_refresh_attachment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_related_type public.finance_related_type;
  v_related_id uuid;
  v_count int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_related_type := OLD.related_type;
    v_related_id := OLD.related_id;
  ELSE
    v_related_type := NEW.related_type;
    v_related_id := NEW.related_id;
  END IF;
  SELECT count(*) INTO v_count FROM public.finance_attachments
    WHERE related_type = v_related_type AND related_id = v_related_id;
  IF v_related_type = 'income' THEN
    UPDATE public.finance_incomes SET attachment_status =
      CASE WHEN v_count > 0 THEN 'attached'::public.finance_attachment_status
           WHEN attachment_status = 'not_required' THEN 'not_required'::public.finance_attachment_status
           ELSE 'not_attached'::public.finance_attachment_status END
      WHERE id = v_related_id;
  ELSIF v_related_type = 'expense' THEN
    UPDATE public.finance_expenses SET attachment_status =
      CASE WHEN v_count > 0 THEN 'attached'::public.finance_attachment_status
           WHEN attachment_status = 'not_required' THEN 'not_required'::public.finance_attachment_status
           ELSE 'not_attached'::public.finance_attachment_status END
      WHERE id = v_related_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END$$;
CREATE TRIGGER trg_fin_att_refresh AFTER INSERT OR DELETE ON public.finance_attachments
  FOR EACH ROW EXECUTE FUNCTION public.finance_refresh_attachment_status();

-- ============ Audit log triggers ============
CREATE OR REPLACE FUNCTION public.finance_write_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  k text;
  ov text; nv text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.finance_audit_logs(related_type, related_id, action, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'create', v_actor);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.finance_audit_logs(related_type, related_id, action, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'delete', v_actor);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT key FROM jsonb_each_text(to_jsonb(NEW)) LOOP
      ov := (to_jsonb(OLD) ->> k);
      nv := (to_jsonb(NEW) ->> k);
      IF ov IS DISTINCT FROM nv AND k NOT IN ('updated_at','created_at') THEN
        INSERT INTO public.finance_audit_logs(related_type, related_id, action, field_name, old_value, new_value, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'update', k, ov, nv, v_actor);
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;
  RETURN NULL;
END$$;
CREATE TRIGGER trg_fin_inc_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_incomes
  FOR EACH ROW EXECUTE FUNCTION public.finance_write_audit();
CREATE TRIGGER trg_fin_exp_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_expenses
  FOR EACH ROW EXECUTE FUNCTION public.finance_write_audit();
CREATE TRIGGER trg_fin_sup_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.finance_write_audit();
CREATE TRIGGER trg_fin_att_audit AFTER INSERT OR DELETE ON public.finance_attachments
  FOR EACH ROW EXECUTE FUNCTION public.finance_write_audit();
CREATE TRIGGER trg_fin_cat_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.finance_write_audit();

-- ============ Seed income sources ============
INSERT INTO public.finance_income_sources (name, display_order) VALUES
  ('Salla', 1), ('Tabby', 2), ('Tamara', 3), ('Bank', 4)
ON CONFLICT (name) DO NOTHING;

-- ============ Seed categories ============
DO $$
DECLARE
  m record;
  parent_id uuid;
  mains text[][] := ARRAY[
    ARRAY['Inventory','Lifestock,Tanks,Turki Tanks,Lights,Filters,Accessories,Stones,Plants,Supplies,Equipment,Packages'],
    ARRAY['Operations & Maintenance','Utilities,Repairs,Other'],
    ARRAY['Administration & Management','Government Fees,Insurance,Bank Fees,Professional Services'],
    ARRAY['Subscriptions & Software','Software,Domains & Hosting,Online Services,Memberships'],
    ARRAY['Marketing & Sales','Advertising,Social Media,Branding,Events'],
    ARRAY['Travel & Transportation','Vehicle Rental,Flights,Expense'],
    ARRAY['Delivery','courier services'],
    ARRAY['Manpower & HR','Salaries,Contractor Fees'],
    ARRAY['COGS','Purchase Cost'],
    ARRAY['Refunds & Adjustments','Customer Refunds,Vendor Refunds,Other'],
    ARRAY['Miscellaneous','Office Supplies,Other,Meals & Entertainment'],
    ARRAY['Personal','Personal']
  ];
  i int;
  sub text;
  ord int := 1;
BEGIN
  FOR i IN 1..array_length(mains,1) LOOP
    INSERT INTO public.finance_categories(name, kind, display_order)
    VALUES (mains[i][1], 'main', ord)
    RETURNING id INTO parent_id;
    ord := ord + 1;
    FOR sub IN SELECT unnest(string_to_array(mains[i][2], ',')) LOOP
      INSERT INTO public.finance_categories(name, kind, parent_id, display_order)
      VALUES (trim(sub), 'sub', parent_id, 1);
    END LOOP;
  END LOOP;
END$$;
