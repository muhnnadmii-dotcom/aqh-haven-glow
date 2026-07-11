
REVOKE EXECUTE ON FUNCTION public.clear_auto_imported_settlement_dates() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.preview_auto_imported_settlement_dates() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rematch_settlement_lines_apply(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rematch_settlement_lines_preview(uuid) FROM PUBLIC, anon;
