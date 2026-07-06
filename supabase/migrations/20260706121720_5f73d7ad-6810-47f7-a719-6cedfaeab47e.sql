
-- 1) site_pages: content_en + title_en
ALTER TABLE public.site_pages
  ADD COLUMN IF NOT EXISTS content_en jsonb,
  ADD COLUMN IF NOT EXISTS title_en text;

-- 2) projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS summary_en text;

-- 3) articles
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS excerpt_en text,
  ADD COLUMN IF NOT EXISTS body_en text;

-- 4) services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS description_en text;

-- 5) ui_translations table
CREATE TABLE IF NOT EXISTS public.ui_translations (
  key         text PRIMARY KEY,
  ar          text NOT NULL DEFAULT '',
  en          text NOT NULL DEFAULT '',
  context     text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid
);

GRANT SELECT ON public.ui_translations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ui_translations TO authenticated;
GRANT ALL ON public.ui_translations TO service_role;

ALTER TABLE public.ui_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ui translations"
  ON public.ui_translations FOR SELECT
  USING (true);

CREATE POLICY "Admin/staff can manage ui translations"
  ON public.ui_translations FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'staff'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'staff'));

CREATE TRIGGER trg_ui_translations_touch
  BEFORE UPDATE ON public.ui_translations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
