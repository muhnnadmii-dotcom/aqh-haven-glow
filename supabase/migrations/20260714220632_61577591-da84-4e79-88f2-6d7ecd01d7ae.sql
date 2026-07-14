
DROP POLICY IF EXISTS "Public can read published gallery items" ON public.work_gallery_items;

CREATE POLICY "Public can read published gallery items"
ON public.work_gallery_items
FOR SELECT
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'staff'::app_role)
  OR (
    is_published = true
    AND (
      linked_project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = work_gallery_items.linked_project_id
          AND p.published = true
      )
    )
  )
);
