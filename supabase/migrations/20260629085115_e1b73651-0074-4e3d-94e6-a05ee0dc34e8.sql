
CREATE TABLE public.site_nav_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location text NOT NULL CHECK (location IN ('navbar','footer_quick')),
  label text NOT NULL,
  href text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  external boolean NOT NULL DEFAULT false,
  open_in_new_tab boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_nav_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_nav_links TO authenticated;
GRANT ALL ON public.site_nav_links TO service_role;

ALTER TABLE public.site_nav_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read nav links"
ON public.site_nav_links FOR SELECT
USING (true);

CREATE POLICY "Admins manage nav links"
ON public.site_nav_links FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.site_nav_links_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_site_nav_links_updated
BEFORE UPDATE ON public.site_nav_links
FOR EACH ROW EXECUTE FUNCTION public.site_nav_links_touch_updated_at();

INSERT INTO public.site_nav_links (location, label, href, sort_order) VALUES
  ('navbar','الرئيسية','/',10),
  ('navbar','أعمالنا','/portfolio',20),
  ('navbar','الخدمات','/services',30),
  ('navbar','الصيانة','/maintenance',40),
  ('navbar','حلول الأعمال','/business-solutions',50),
  ('navbar','مركز المعرفة','/knowledge',60),
  ('navbar','تواصل معنا','/contact',70),
  ('footer_quick','أعمالنا','/portfolio',10),
  ('footer_quick','خدماتنا','/services',20),
  ('footer_quick','الكاتلوج','/catalog',30),
  ('footer_quick','مركز المعرفة','/knowledge',40),
  ('footer_quick','من نحن','/about',50);
