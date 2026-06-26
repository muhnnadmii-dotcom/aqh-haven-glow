
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  m jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_birth date;
BEGIN
  BEGIN
    v_birth := NULLIF(m->>'birth_date','')::date;
  EXCEPTION WHEN OTHERS THEN
    v_birth := NULL;
  END;

  INSERT INTO public.profiles (id, full_name, phone, email, city, birth_date, salla_order_no)
  VALUES (
    NEW.id,
    COALESCE(m->>'full_name', m->>'name', ''),
    NULLIF(m->>'phone',''),
    COALESCE(NULLIF(m->>'email',''), NEW.email),
    NULLIF(m->>'city',''),
    v_birth,
    NULLIF(m->>'salla_order_no','')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;
