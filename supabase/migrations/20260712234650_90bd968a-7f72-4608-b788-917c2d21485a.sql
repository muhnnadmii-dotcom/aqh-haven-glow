
ALTER TABLE public.site_pages
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "Public read site_pages" ON public.site_pages;
CREATE POLICY "Public read published site_pages"
  ON public.site_pages
  FOR SELECT
  TO public
  USING (published = true);
