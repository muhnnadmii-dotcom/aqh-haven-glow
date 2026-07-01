
-- 1) Recreate aqh_quote_products with security_invoker and remove anon access
DROP VIEW IF EXISTS public.aqh_quote_products;
CREATE VIEW public.aqh_quote_products
WITH (security_invoker = true) AS
  SELECT 'salla'::text AS source,
     p.sku AS ref,
     p.name_ar AS name,
     p.category,
     NULL::text AS supplier_name,
     p.cost,
     p.price,
     NULL::numeric AS supplier_cost,
     p.image_url
    FROM public.aqh_products p
   WHERE p.is_active = true
 UNION ALL
  SELECT 'supplier'::text AS source,
     sp.item_no AS ref,
     sp.name,
     sp.supplier_name AS category,
     sp.supplier_name,
     NULL::numeric AS cost,
     NULL::numeric AS price,
     sp.cost AS supplier_cost,
     NULL::text AS image_url
    FROM public.aqh_supplier_products sp
   WHERE sp.is_active = true;

REVOKE ALL ON public.aqh_quote_products FROM anon;
GRANT SELECT ON public.aqh_quote_products TO authenticated;
GRANT ALL ON public.aqh_quote_products TO service_role;

-- 2) Revoke EXECUTE from public/anon/authenticated on SECURITY DEFINER trigger
--    helpers that must only run inside the database, not via the Data API.
DO $$
DECLARE
  fn text;
  trigger_fns text[] := ARRAY[
    'appointments_guard_sensitive_fields()',
    'finance_accountant_guard()',
    'finance_refresh_attachment_status()',
    'finance_write_audit()',
    'handle_new_user()',
    'log_assignment_event()',
    'notifications_owner_update_guard()',
    'notify_on_appointment()',
    'notify_on_assignment()',
    'notify_on_public_note()',
    'notify_on_report()',
    'notify_on_status_change()'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM authenticated', fn);
  END LOOP;
END $$;

-- 3) For RPC helpers that ARE meant to be called by the app, revoke from anon
--    (they still work for signed-in users) but keep EXECUTE for authenticated.
REVOKE ALL ON FUNCTION public.i_have_any_custom_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.i_have_any_custom_role() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_custom_allowed_pages() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_custom_allowed_pages() TO authenticated;

REVOKE ALL ON FUNCTION public.finance_get_actor_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_get_actor_names(uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION public.finance_archive_import_batch(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_archive_import_batch(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.finance_restore_import_batch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_restore_import_batch(uuid) TO authenticated;
