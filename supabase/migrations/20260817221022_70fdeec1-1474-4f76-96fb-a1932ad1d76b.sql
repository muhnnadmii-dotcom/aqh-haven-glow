CREATE OR REPLACE FUNCTION public.salla_import_preview(p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE r jsonb; out_arr jsonb := '[]'::jsonb; c jsonb;
BEGIN
  IF NOT (private.has_role(auth.uid(),'admin')
          OR private.has_role(auth.uid(),'finance_manage')
          OR private.has_role(auth.uid(),'finance_accountant')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows,'[]'::jsonb)) LOOP
    c := public.salla_classify_row(r);
    -- IMPORTANT: build ONE merged object per row, then append it as a single
    -- array element. The previous version did `out_arr || obj || c`, which
    -- appended TWO separate elements per row (identity object without action,
    -- then classification object without rowNo), so the client could never
    -- match a row to its action and defaulted every row to "blocked".
    out_arr := out_arr || jsonb_build_array(
      c || jsonb_build_object(
        'rowNo', (r->>'rowNo')::int,
        'external_order_id', r->>'external_order_id'
      )
    );
  END LOOP;
  RETURN out_arr;
END $function$;