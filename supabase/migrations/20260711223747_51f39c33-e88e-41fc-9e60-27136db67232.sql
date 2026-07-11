
REVOKE EXECUTE ON FUNCTION public.apply_settlement_allocation(uuid, uuid, numeric, settlement_allocation_difference_type, text, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reverse_settlement_allocation(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_settlement_status(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.settlement_allocated_total(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.income_allocated_total(uuid) FROM anon, PUBLIC;
