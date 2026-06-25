# Live hero stats from real customer data

Replace the hard-coded fallback numbers in the homepage hero card (250 عميل سعيد، 9 سنوات خبرة، 180 مشروع، 98% رضا) with real values pulled from the database, while keeping admins' configured stats (`hero.stats`) as an override.

## What the four cards will show

1. **عملاء مسجلون** — distinct customers who have at least one tank in `customer_tanks` (DISTINCT `user_id`).
2. **أحواض مسجّلة** — total rows in `customer_tanks`.
3. **مشاريع منفذة** — published projects (`projects` where `published = true`).
4. **سنوات خبرة** — stays static (`9+`), since this is a brand fact, not data.

If the admin has configured `hero.stats` in the home sections editor, those still win (no change to admin behavior). Live numbers are only used as the fallback in place of the current hard-coded array.

## How to fetch safely

The home route is public and SSR-rendered, so we can't use `requireSupabaseAuth`. Add a public `createServerFn` (`getHomeHeroStats`) in `src/lib/home-stats.functions.ts` that uses the **server publishable client** (anon) with `count: "exact", head: true` queries:

- `customer_tanks` count → tanks total
- `customer_tanks` select distinct `user_id` → customers count (small set; fine to fetch ids and dedupe in JS, or use an RPC if anon SELECT isn't allowed)
- `projects` count where `published = true`

If anon SELECT on `customer_tanks` is not currently allowed by RLS (likely — it's user-owned data), expose a tiny `SECURITY DEFINER` SQL function `public.get_home_hero_stats()` returning `(customers int, tanks int, projects int)` and grant EXECUTE to `anon, authenticated`. The server fn just calls `supabase.rpc("get_home_hero_stats")`. This avoids loosening RLS on private tables.

## Wiring

- Call `getHomeHeroStats` inside the existing `loader` in `src/routes/index.tsx` (alongside the other `Promise.all` reads) and pass it through loader data.
- Build `heroStats` fallback from the live numbers instead of the hard-coded array:
  ```
  { value: customers, suffix: "+", label: "عميل مسجّل" }
  { value: 9,         suffix: "+", label: "سنوات خبرة" }
  { value: projects,  suffix: "+", label: "مشروع منفذ" }
  { value: tanks,     suffix: "+", label: "حوض مُدار" }
  ```
- Keep the `configuredStats` override path untouched.
- `<Counter />` already animates from 0 to the real value — no component change.

## Files

- **New migration**: `public.get_home_hero_stats()` SECURITY DEFINER + GRANT EXECUTE TO anon, authenticated.
- **New**: `src/lib/home-stats.functions.ts` (public server fn calling the RPC via server publishable client).
- **Edited**: `src/routes/index.tsx` — loader fetches stats, hero fallback uses live data.

## Out of scope

- No changes to `CustomerHomeCard` (already shows real per-user data).
- No changes to admin stats editor.
- No changes to existing `home_sections` content.
