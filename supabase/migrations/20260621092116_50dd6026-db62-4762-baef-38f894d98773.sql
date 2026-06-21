
-- Add archival fields to finance_import_logs
ALTER TABLE public.finance_import_logs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;

ALTER TABLE public.finance_import_logs
  DROP CONSTRAINT IF EXISTS finance_import_logs_status_check;
ALTER TABLE public.finance_import_logs
  ADD CONSTRAINT finance_import_logs_status_check CHECK (status IN ('active','archived','partial'));

-- Allow admin/finance_manage to update (archive/restore)
DROP POLICY IF EXISTS finance_import_logs_update ON public.finance_import_logs;
CREATE POLICY finance_import_logs_update ON public.finance_import_logs
  FOR UPDATE
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'finance_manage'));

-- Archive an entire import batch (soft-delete linked rows + mark log)
CREATE OR REPLACE FUNCTION public.finance_archive_import_batch(p_batch_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_log public.finance_import_logs%ROWTYPE;
  v_inc int := 0;
  v_exp int := 0;
BEGIN
  IF NOT (private.has_role(v_actor,'admin') OR private.has_role(v_actor,'finance_manage')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_log FROM public.finance_import_logs WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch not found'; END IF;

  IF v_log.import_type = 'incomes' THEN
    UPDATE public.finance_incomes
       SET deleted_at = now(), deleted_by = v_actor,
           delete_reason = COALESCE(p_reason, 'archive_batch')
     WHERE import_batch_id = p_batch_id AND deleted_at IS NULL;
    GET DIAGNOSTICS v_inc = ROW_COUNT;
  ELSIF v_log.import_type = 'expenses' THEN
    UPDATE public.finance_expenses
       SET deleted_at = now(), deleted_by = v_actor,
           delete_reason = COALESCE(p_reason, 'archive_batch')
     WHERE import_batch_id = p_batch_id AND deleted_at IS NULL;
    GET DIAGNOSTICS v_exp = ROW_COUNT;
  END IF;

  UPDATE public.finance_import_logs
     SET status = 'archived',
         archived_at = now(),
         archived_by = v_actor,
         archive_reason = p_reason
   WHERE id = p_batch_id;

  INSERT INTO public.finance_audit_logs(related_type, related_id, action, field_name, old_value, new_value, changed_by)
  VALUES ('finance_import_logs', p_batch_id, 'archive_batch', 'status',
          v_log.status, 'archived', v_actor);

  RETURN jsonb_build_object('incomes_archived', v_inc, 'expenses_archived', v_exp);
END$$;

REVOKE ALL ON FUNCTION public.finance_archive_import_batch(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_archive_import_batch(uuid, text) TO authenticated;

-- Restore an archived import batch
CREATE OR REPLACE FUNCTION public.finance_restore_import_batch(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_log public.finance_import_logs%ROWTYPE;
  v_inc int := 0;
  v_exp int := 0;
BEGIN
  IF NOT (private.has_role(v_actor,'admin') OR private.has_role(v_actor,'finance_manage')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_log FROM public.finance_import_logs WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch not found'; END IF;

  IF v_log.import_type = 'incomes' THEN
    UPDATE public.finance_incomes
       SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
     WHERE import_batch_id = p_batch_id
       AND deleted_at IS NOT NULL
       AND delete_reason = COALESCE(v_log.archive_reason,'archive_batch');
    GET DIAGNOSTICS v_inc = ROW_COUNT;
    -- fallback: if reason mismatch, restore all archived in batch
    IF v_inc = 0 THEN
      UPDATE public.finance_incomes
         SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
       WHERE import_batch_id = p_batch_id AND deleted_at IS NOT NULL;
      GET DIAGNOSTICS v_inc = ROW_COUNT;
    END IF;
  ELSIF v_log.import_type = 'expenses' THEN
    UPDATE public.finance_expenses
       SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
     WHERE import_batch_id = p_batch_id
       AND deleted_at IS NOT NULL
       AND delete_reason = COALESCE(v_log.archive_reason,'archive_batch');
    GET DIAGNOSTICS v_exp = ROW_COUNT;
    IF v_exp = 0 THEN
      UPDATE public.finance_expenses
         SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
       WHERE import_batch_id = p_batch_id AND deleted_at IS NOT NULL;
      GET DIAGNOSTICS v_exp = ROW_COUNT;
    END IF;
  END IF;

  UPDATE public.finance_import_logs
     SET status = 'active', archived_at = NULL, archived_by = NULL, archive_reason = NULL
   WHERE id = p_batch_id;

  INSERT INTO public.finance_audit_logs(related_type, related_id, action, field_name, old_value, new_value, changed_by)
  VALUES ('finance_import_logs', p_batch_id, 'restore_batch', 'status',
          'archived', 'active', v_actor);

  RETURN jsonb_build_object('incomes_restored', v_inc, 'expenses_restored', v_exp);
END$$;

REVOKE ALL ON FUNCTION public.finance_restore_import_batch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_restore_import_batch(uuid) TO authenticated;
