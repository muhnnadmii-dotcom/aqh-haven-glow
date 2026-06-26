
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS salla_order_no TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS order_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_consults_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_consults_used INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_salla_order_no ON public.profiles(salla_order_no);

-- Prevent regular users from modifying privileged fields
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF private.has_role(auth.uid(), 'admin'::public.app_role)
     OR private.has_role(auth.uid(), 'staff'::public.app_role) THEN
    RETURN NEW;
  END IF;
  NEW.order_verified := OLD.order_verified;
  NEW.free_consults_total := OLD.free_consults_total;
  NEW.free_consults_used := OLD.free_consults_used;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privileged_fields_trg ON public.profiles;
CREATE TRIGGER profiles_guard_privileged_fields_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged_fields();
