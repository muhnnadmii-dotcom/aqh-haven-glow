
DROP POLICY IF EXISTS "Public read testimonials" ON public.testimonials;
CREATE POLICY "Public read testimonials" ON public.testimonials
  FOR SELECT TO anon, authenticated
  USING (visible = true);

REVOKE EXECUTE ON FUNCTION public.delete_settlement_full(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_settlement_full(uuid, text) TO authenticated;
