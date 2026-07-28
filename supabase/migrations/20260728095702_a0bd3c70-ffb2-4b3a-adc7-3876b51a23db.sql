UPDATE public.site_pages
SET content = '{"sections": []}'::jsonb, content_en = NULL, updated_at = now()
WHERE page_key = 'business_solutions';