
CREATE TABLE public.work_gallery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  image_path text NOT NULL,
  extra_images text[] NOT NULL DEFAULT '{}',
  tank_type text,
  size_category text,
  style text,
  care_level text,
  suitable_for text[] NOT NULL DEFAULT '{}',
  linked_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  is_published boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.work_gallery_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_gallery_items TO authenticated;
GRANT ALL ON public.work_gallery_items TO service_role;

ALTER TABLE public.work_gallery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published gallery items"
  ON public.work_gallery_items FOR SELECT
  USING (is_published = true OR private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'staff'::public.app_role));

CREATE POLICY "Admins can insert gallery items"
  ON public.work_gallery_items FOR INSERT
  TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update gallery items"
  ON public.work_gallery_items FOR UPDATE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete gallery items"
  ON public.work_gallery_items FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_work_gallery_items_updated_at
  BEFORE UPDATE ON public.work_gallery_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_work_gallery_published_order
  ON public.work_gallery_items (is_published, display_order DESC, created_at DESC);
CREATE INDEX idx_work_gallery_linked_project
  ON public.work_gallery_items (linked_project_id);
