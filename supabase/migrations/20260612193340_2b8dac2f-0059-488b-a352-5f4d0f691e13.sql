
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + assign customer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Projects (Aquariums)
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'living-room',
  category_label TEXT,
  featured BOOLEAN NOT NULL DEFAULT false,
  published BOOLEAN NOT NULL DEFAULT true,
  location TEXT,
  year TEXT,
  description TEXT,
  cover TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  specs JSONB NOT NULL DEFAULT '{}',
  equipment JSONB NOT NULL DEFAULT '{}',
  water_system TEXT[],
  add_ons TEXT[],
  service_packages TEXT[],
  livestock_warranty TEXT,
  contents JSONB NOT NULL DEFAULT '{}',
  price_min INTEGER,
  price_max INTEGER,
  currency TEXT NOT NULL DEFAULT 'SAR',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.projects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published projects" ON public.projects FOR SELECT USING (published = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage projects" ON public.projects FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER projects_touch BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Articles
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT,
  cover_image TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  published BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.articles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published articles" ON public.articles FOR SELECT USING (published = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage articles" ON public.articles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER articles_touch BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Testimonials
CREATE TABLE public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  body TEXT NOT NULL,
  featured BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.testimonials TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.testimonials TO authenticated;
GRANT ALL ON public.testimonials TO service_role;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read testimonials" ON public.testimonials FOR SELECT USING (true);
CREATE POLICY "Admins manage testimonials" ON public.testimonials FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER testimonials_touch BEFORE UPDATE ON public.testimonials FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Contact requests
CREATE TYPE public.request_status AS ENUM ('new', 'in_progress', 'closed');

CREATE TABLE public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  status public.request_status NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_requests TO authenticated;
GRANT ALL ON public.contact_requests TO service_role;
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit contact" ON public.contact_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Users read own contact requests" ON public.contact_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage contact" ON public.contact_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER contact_touch BEFORE UPDATE ON public.contact_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Consultation requests
CREATE TABLE public.consultation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  tank_type TEXT,
  goal TEXT,
  size TEXT,
  details TEXT NOT NULL,
  status public.request_status NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.consultation_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.consultation_requests TO authenticated;
GRANT ALL ON public.consultation_requests TO service_role;
ALTER TABLE public.consultation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit consultation" ON public.consultation_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Users read own consultations" ON public.consultation_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage consultations" ON public.consultation_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER consultation_touch BEFORE UPDATE ON public.consultation_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
