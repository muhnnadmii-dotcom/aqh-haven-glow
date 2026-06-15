
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS equipment_warranty_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS equipment_warranty_text text,
  ADD COLUMN IF NOT EXISTS livestock_warranty_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS livestock_warranty_text text;

UPDATE public.projects
  SET livestock_warranty_text = livestock_warranty,
      livestock_warranty_enabled = true
  WHERE livestock_warranty IS NOT NULL
    AND btrim(livestock_warranty) <> ''
    AND livestock_warranty_text IS NULL;
