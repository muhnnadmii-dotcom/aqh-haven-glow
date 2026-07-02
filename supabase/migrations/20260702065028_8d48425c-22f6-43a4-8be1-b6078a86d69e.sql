
ALTER TABLE public.finance_categories
  ADD COLUMN IF NOT EXISTS system_slug text;

CREATE UNIQUE INDEX IF NOT EXISTS finance_categories_system_slug_key
  ON public.finance_categories (system_slug)
  WHERE system_slug IS NOT NULL;

INSERT INTO public.finance_categories (name, kind, parent_id, is_active, display_order, system_slug)
SELECT 'توزيع الأرباح', 'main'::public.finance_category_kind, NULL, true, 999, 'owner_draw'
WHERE NOT EXISTS (
  SELECT 1 FROM public.finance_categories WHERE system_slug = 'owner_draw'
);

-- Create a "Withdrawal" sub-category under Owner Draw so expenses can pick a sub too
DO $$
DECLARE v_parent uuid;
BEGIN
  SELECT id INTO v_parent FROM public.finance_categories WHERE system_slug = 'owner_draw';
  IF v_parent IS NOT NULL THEN
    INSERT INTO public.finance_categories (name, kind, parent_id, is_active, display_order)
    SELECT 'سحب', 'sub'::public.finance_category_kind, v_parent, true, 0
    WHERE NOT EXISTS (
      SELECT 1 FROM public.finance_categories WHERE parent_id = v_parent AND name = 'سحب'
    );
  END IF;
END $$;
