
-- Custom roles system (UI/route gating layer above core RLS roles)

CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_roles TO authenticated;
GRANT ALL ON public.custom_roles TO service_role;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage custom_roles"
ON public.custom_roles FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER touch_custom_roles BEFORE UPDATE ON public.custom_roles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


CREATE TABLE public.custom_role_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  page_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, page_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_role_pages TO authenticated;
GRANT ALL ON public.custom_role_pages TO service_role;
ALTER TABLE public.custom_role_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage custom_role_pages"
ON public.custom_role_pages FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_custom_role_pages_role ON public.custom_role_pages(role_id);


CREATE TABLE public.user_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_custom_roles TO authenticated;
GRANT ALL ON public.user_custom_roles TO service_role;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage user_custom_roles"
ON public.user_custom_roles FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_user_custom_roles_user ON public.user_custom_roles(user_id);
CREATE INDEX idx_user_custom_roles_role ON public.user_custom_roles(role_id);


-- Function: get the set of allowed admin page keys for current user.
-- Returns NULL meaning "no custom restriction defined for this user"
-- (caller falls back to core role defaults).
CREATE OR REPLACE FUNCTION public.get_my_custom_allowed_pages()
RETURNS TABLE(page_key text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT DISTINCT crp.page_key
  FROM public.user_custom_roles ucr
  JOIN public.custom_role_pages crp ON crp.role_id = ucr.role_id
  WHERE ucr.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_custom_allowed_pages() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_custom_allowed_pages() TO authenticated;


-- Helper: does current user have ANY custom role assigned?
CREATE OR REPLACE FUNCTION public.i_have_any_custom_role()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_custom_roles WHERE user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.i_have_any_custom_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.i_have_any_custom_role() TO authenticated;
