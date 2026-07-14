
-- Reset 25 diverse rows to force reclassification via the new trigger
WITH picks AS (
  (SELECT e.id
     FROM public.finance_expenses e
     JOIN public.finance_categories mc ON mc.id=e.main_category_id
     LEFT JOIN public.finance_categories sc ON sc.id=e.sub_category_id
    WHERE e.deleted_at IS NULL AND mc.name='Administration & Management' AND sc.name='Government Fees'
      AND e.purchase_invoice_id IS NULL LIMIT 4)
  UNION ALL
  (SELECT e.id FROM public.finance_expenses e
     JOIN public.finance_categories mc ON mc.id=e.main_category_id
     LEFT JOIN public.finance_categories sc ON sc.id=e.sub_category_id
    WHERE e.deleted_at IS NULL AND mc.name='Administration & Management' AND sc.name='Bank Fees'
      AND e.purchase_invoice_id IS NULL LIMIT 3)
  UNION ALL
  (SELECT e.id FROM public.finance_expenses e
     JOIN public.finance_categories mc ON mc.id=e.main_category_id
     LEFT JOIN public.finance_categories sc ON sc.id=e.sub_category_id
    WHERE e.deleted_at IS NULL AND mc.name='Manpower & HR' AND sc.name='Salaries'
      AND e.purchase_invoice_id IS NULL LIMIT 4)
  UNION ALL
  (SELECT e.id FROM public.finance_expenses e
     JOIN public.finance_categories mc ON mc.id=e.main_category_id
    WHERE e.deleted_at IS NULL AND mc.name='Personal'
      AND e.purchase_invoice_id IS NULL LIMIT 4)
  UNION ALL
  (SELECT e.id FROM public.finance_expenses e
     JOIN public.finance_categories mc ON mc.id=e.main_category_id
    WHERE e.deleted_at IS NULL AND mc.name='توزيع الأرباح'
      AND e.purchase_invoice_id IS NULL LIMIT 3)
  UNION ALL
  (SELECT e.id FROM public.finance_expenses e
     JOIN public.finance_categories mc ON mc.id=e.main_category_id
    WHERE e.deleted_at IS NULL AND mc.name='Inventory'
      AND e.purchase_invoice_id IS NULL LIMIT 4)
  UNION ALL
  (SELECT e.id FROM public.finance_expenses e
     JOIN public.finance_categories mc ON mc.id=e.main_category_id
    WHERE e.deleted_at IS NULL AND mc.name='Marketing & Sales'
      AND e.purchase_invoice_id IS NULL LIMIT 3)
)
UPDATE public.finance_expenses e
   SET transaction_type = NULL,
       business_relation = 'unclassified',
       accounting_status = 'unclassified',
       updated_at = now()
  FROM picks
 WHERE e.id = picks.id;
