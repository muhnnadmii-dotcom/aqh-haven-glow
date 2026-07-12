
-- Restrict admin/customer policies to authenticated role
ALTER POLICY "Customer update own pending appts" ON public.appointments TO authenticated;
ALTER POLICY "Admins manage categories" ON public.project_categories TO authenticated;
ALTER POLICY "Customers read own visible status history" ON public.request_status_history TO authenticated;

-- Revoke anon EXECUTE on SECURITY DEFINER audit function
REVOKE EXECUTE ON FUNCTION public.finance_log_manual_audit(text, uuid, text, text, text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.finance_log_manual_audit(text, uuid, text, text, text, text, text) TO authenticated;
