REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;

DROP POLICY IF EXISTS "Public read published articles" ON public.articles;
CREATE POLICY "Public read published articles"
ON public.articles
FOR SELECT
TO anon
USING (published = true AND visible = true);
CREATE POLICY "Authenticated read published articles"
ON public.articles
FOR SELECT
TO authenticated
USING (published = true AND visible = true);

DROP POLICY IF EXISTS "Public read published projects" ON public.projects;
CREATE POLICY "Public read published projects"
ON public.projects
FOR SELECT
TO anon
USING (published = true);
CREATE POLICY "Authenticated read published projects"
ON public.projects
FOR SELECT
TO authenticated
USING (published = true);

DROP POLICY IF EXISTS "Public read services" ON public.services;
CREATE POLICY "Public read services"
ON public.services
FOR SELECT
TO anon
USING (published = true);
CREATE POLICY "Authenticated read services"
ON public.services
FOR SELECT
TO authenticated
USING (published = true);