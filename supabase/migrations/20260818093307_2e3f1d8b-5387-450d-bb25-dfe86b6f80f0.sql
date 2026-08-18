
CREATE OR REPLACE FUNCTION public.salla_classify_row(p_row jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_oid text := NULLIF(btrim(COALESCE(p_row->>'external_order_id','')), '');
  v_inv text := NULLIF(btrim(COALESCE(p_row->>'external_invoice_number','')), '');
  v_cancel boolean := COALESCE((p_row->>'cancelled')::boolean, false);
  v_total numeric(14,2) := ROUND(COALESCE((p_row->>'original_gross_amount')::numeric,0),2);
  v_vat numeric(14,2) := ROUND(COALESCE((p_row->>'total_vat_amount')::numeric,0),2);
  e record;
  o record;
  v_changed boolean;
  v_disc_code text; v_payrefs jsonb; v_src_upd timestamptz;
  v_order_ref text; v_products_raw text; v_phone text;
  v_meta boolean;
  v_ship_co text; v_ship_num text; v_ship_date date; v_ship_url text;
  s_co text; s_num text; s_date date; s_url text;
  v_ship_meta boolean;
BEGIN
  IF v_oid IS NULL THEN
    RETURN jsonb_build_object('action','blocked','reason','رقم الطلب مفقود');
  END IF;
  IF (p_row->>'order_date') IS NULL OR btrim(p_row->>'order_date') = '' THEN
    RETURN jsonb_build_object('action','blocked','reason','تاريخ الطلب غير صالح');
  END IF;

  SELECT id, status, external_invoice_number, total_amount, vat_amount, data_completeness_status,
         discount_code, payment_references, source_updated_at,
         external_order_reference, source_products_raw, customer_phone_snapshot,
         shipping_company, shipment_number, policy_issued_at, tracking_url
    INTO e
  FROM public.sales_invoices
  WHERE sales_channel='salla' AND external_order_id = v_oid;

  IF NOT FOUND THEN
    IF v_cancel THEN
      RETURN jsonb_build_object('action','cancelled_new','reason','طلب ملغي — يُحفظ كسجل طلب فقط');
    END IF;
    IF v_total <= 0 THEN
      RETURN jsonb_build_object('action','blocked','reason','إجمالي الطلب = 0');
    END IF;
    RETURN jsonb_build_object('action', CASE WHEN v_inv IS NULL THEN 'new_missing_invoice_number' ELSE 'new' END,
                              'reason', CASE WHEN v_inv IS NULL THEN 'طلب جديد بدون رقم فاتورة — يبقى مسودة' ELSE 'طلب جديد مكتمل' END);
  END IF;

  IF v_cancel THEN
    IF e.status = 'draft' THEN
      RETURN jsonb_build_object('action','cancel_draft','reason','إلغاء آمن لمسودة','existing_id',e.id,'existing_status',e.status);
    END IF;
    RETURN jsonb_build_object('action','needs_credit_note','reason','الطلب ملغي والفاتورة معتمدة — يلزم إشعار دائن','existing_id',e.id,'existing_status',e.status);
  END IF;

  v_changed := (COALESCE(e.external_invoice_number,'') IS DISTINCT FROM COALESCE(v_inv,''))
               OR ABS(COALESCE(e.total_amount,0) - v_total) > 0.02
               OR ABS(COALESCE(e.vat_amount,0) - v_vat) > 0.02;

  -- informational source-only fields (evaluated for drafts and final invoices alike)
  v_disc_code := NULLIF(btrim(COALESCE(p_row->>'discount_code','')), '');
  v_payrefs := CASE WHEN jsonb_typeof(p_row->'payment_references') = 'array'
                    THEN p_row->'payment_references' ELSE '[]'::jsonb END;
  BEGIN
    v_src_upd := NULLIF(btrim(COALESCE(p_row->>'source_updated_at','')), '')::timestamptz;
  EXCEPTION WHEN others THEN v_src_upd := NULL;
  END;
  v_order_ref := NULLIF(btrim(COALESCE(p_row->>'external_order_reference','')), '');
  v_products_raw := NULLIF(btrim(COALESCE(p_row->>'source_products_raw','')), '');
  v_phone := NULLIF(btrim(COALESCE(p_row->>'customer_phone_snapshot','')), '');

  -- shipping metadata (written only by salla_apply_shipping_metadata)
  v_ship_co  := public.normalize_shipping_company(p_row->>'shipping_company');
  v_ship_num := NULLIF(btrim(COALESCE(p_row->>'shipment_number','')), '');
  v_ship_url := NULLIF(btrim(COALESCE(p_row->>'tracking_url','')), '');
  BEGIN
    v_ship_date := NULLIF(btrim(COALESCE(p_row->>'policy_issued_at','')), '')::date;
  EXCEPTION WHEN others THEN v_ship_date := NULL;
  END;

  SELECT shipping_company, shipment_number, policy_issued_at, tracking_url
    INTO o
  FROM public.salla_orders
  WHERE external_order_id = v_oid
  LIMIT 1;

  s_co   := COALESCE(e.shipping_company,  o.shipping_company);
  s_num  := COALESCE(e.shipment_number,   o.shipment_number);
  s_date := COALESCE(e.policy_issued_at,  o.policy_issued_at);
  s_url  := COALESCE(e.tracking_url,      o.tracking_url);

  v_ship_meta := (v_ship_co   IS NOT NULL AND (s_co   IS NULL OR s_co   IS DISTINCT FROM v_ship_co))
              OR (v_ship_num  IS NOT NULL AND (s_num  IS NULL OR s_num  IS DISTINCT FROM v_ship_num))
              OR (v_ship_date IS NOT NULL AND (s_date IS NULL OR s_date IS DISTINCT FROM v_ship_date))
              OR (v_ship_url  IS NOT NULL AND (s_url  IS NULL OR s_url  IS DISTINCT FROM v_ship_url));

  v_meta := (v_disc_code IS NOT NULL AND v_disc_code IS DISTINCT FROM e.discount_code)
         OR (jsonb_array_length(v_payrefs) > 0 AND v_payrefs IS DISTINCT FROM COALESCE(e.payment_references,'[]'::jsonb))
         OR (v_src_upd IS NOT NULL AND (e.source_updated_at IS NULL OR v_src_upd > e.source_updated_at))
         OR (v_order_ref IS NOT NULL AND v_order_ref IS DISTINCT FROM e.external_order_reference)
         OR (v_products_raw IS NOT NULL AND v_products_raw IS DISTINCT FROM e.source_products_raw)
         OR (v_phone IS NOT NULL AND v_phone IS DISTINCT FROM e.customer_phone_snapshot)
         OR v_ship_meta;

  IF e.status = 'draft' THEN
    IF v_total <= 0 THEN
      RETURN jsonb_build_object('action','blocked','reason','إجمالي الطلب = 0','existing_id',e.id,'existing_status',e.status);
    END IF;
    IF v_changed OR v_meta OR NOT EXISTS (SELECT 1 FROM public.sales_invoice_items WHERE invoice_id = e.id) THEN
      RETURN jsonb_build_object('action','update_existing_draft',
        'reason', CASE WHEN v_changed THEN 'مسودة موجودة — سيتم تحديثها من سلة'
                       ELSE 'مسودة موجودة — اختلاف بيانات المصدر فقط' END,
        'existing_id',e.id,'existing_status',e.status,'metadata_changed', v_meta,
        'shipping_changed', v_ship_meta);
    END IF;
    RETURN jsonb_build_object('action','unchanged','reason','لا تغيير','existing_id',e.id,'existing_status',e.status);
  END IF;

  IF v_changed THEN
    RETURN jsonb_build_object('action','conflict_existing_final',
      'reason', CASE WHEN v_meta
                     THEN 'فاتورة نهائية وبياناتها المالية تختلف عن الملف — للمراجعة فقط، مع تحديث بيانات المصدر فقط'
                     ELSE 'فاتورة نهائية وبياناتها تختلف عن الملف — للمراجعة فقط' END,
      'existing_id',e.id,'existing_status',e.status,'metadata_changed', v_meta,
      'shipping_changed', v_ship_meta);
  END IF;

  IF v_meta THEN
    RETURN jsonb_build_object('action','metadata_only_update',
      'reason', CASE WHEN v_ship_meta
                     THEN 'فاتورة نهائية مطابقة ماليًا — تحديث بيانات المصدر/الشحن فقط'
                     ELSE 'فاتورة نهائية مطابقة ماليًا — تحديث بيانات المصدر فقط' END,
      'existing_id',e.id,'existing_status',e.status,'metadata_changed', true,
      'shipping_changed', v_ship_meta);
  END IF;

  RETURN jsonb_build_object('action','unchanged','reason','فاتورة نهائية مطابقة','existing_id',e.id,'existing_status',e.status);
END $function$;
