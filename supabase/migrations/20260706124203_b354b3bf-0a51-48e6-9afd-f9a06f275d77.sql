ALTER TABLE public.site_nav_links ADD COLUMN IF NOT EXISTS label_en text;

-- Backfill common labels
UPDATE public.site_nav_links SET label_en = CASE href
  WHEN '/' THEN 'Home'
  WHEN '/portfolio' THEN 'Our Work'
  WHEN '/services' THEN 'Services'
  WHEN '/maintenance' THEN 'Maintenance'
  WHEN '/business-solutions' THEN 'Business Solutions'
  WHEN '/knowledge' THEN 'Knowledge'
  WHEN '/contact' THEN 'Contact'
  WHEN '/about' THEN 'About'
  WHEN '/catalog' THEN 'Catalog'
  ELSE label_en
END
WHERE label_en IS NULL OR label_en = '';