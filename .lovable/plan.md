# Admin Content Management — Phased Plan

The request covers ~10 large admin areas. Most schema and image infrastructure already exists in the codebase (DnD reorder, primary image, delete, mixed old/new image rendering, price types, warranty fields, home_sections table, services with FAQs/features/CTA types, etc.). The actual user-visible pain is concentrated in a few places.

I'll deliver this in **5 phases**. Each phase is one turn; you tell me which to do first or do them in order.

---

## Phase 1 — Bug fixes (critical, fast)

The "can't type Space / Enter" complaint is real and reproducible:

- `admin/services` textareas (features, includes, suitable_for, process_steps) call `split("\n").map(trim).filter(Boolean)` on **every keystroke**, so trailing spaces and empty lines are stripped while typing.
- `admin/design/contact` `request_types` textarea has the same bug.

**Fix**: store the raw textarea string in local state, only convert to array on save. Apply pattern across all line-list textareas. Also audit every input/textarea in `/admin/*` for `onKeyDown` Enter handlers that submit forms inside textareas — none found yet, but I'll sweep.

Also: replace any `Enter`-blocks on forms with explicit submit buttons, ensure RTL `dir="auto"` on free-text fields, add `inputMode` where useful.

## Phase 2 — Permissions: editor + viewer roles

Today the `app_role` enum only has `admin/staff/customer`. To match the spec:

- Add `editor` and `viewer` values to the `app_role` enum (Postgres `ALTER TYPE`).
- RLS / route gates:
  - `admin/staff` keep current full access (operations).
  - `editor` gets write access to: projects, project_categories, services, articles, testimonials, home_sections, site_pages.
  - `viewer` gets read-only access to all admin pages.
  - `customer` blocked from `/admin/*`.
- Update the admin layout `beforeLoad` to accept `admin|staff|editor|viewer`.
- Add a `useAdminRole()` hook that returns the highest role, plus `canEdit()` / `canDelete()` helpers, and wire them into every admin page (disable save/delete buttons for viewers).
- Update RLS policies on the content tables (projects, articles, services, testimonials, home_sections, site_pages, project_categories) so editor + admin can write, viewer + others cannot.
- Update `admin/staff` page so admin can assign any of the 4 roles.

## Phase 3 — Projects (أعمالنا) polish

`admin/projects.tsx` already has 90% of the spec (price_type, warranty checkbox+text, liters auto-calc field, DnD images, primary image, delete, mixed legacy/new). Remaining gaps:

- Verify auto-liters formula triggers on every dimension change (currently does — confirm).
- Add list-view toggle (cards ↔ table) on top, plus filters: search, category, city, published, featured-on-home.
- Add bulk publish/unpublish/feature toggles on each row.
- Ensure "ضمان مخفي للزائر" path on detail page when toggles off (visitor page, minimal touch).

## Phase 4 — Categories + Testimonials + Services + Articles polish

- Categories: delete-guard. Count projects per category, block delete if in use, offer "move projects to: غير مصنف" before delete.
- Testimonials: add featured-on-home toggle UI if missing, plus image upload (current has just text).
- Services: rebuild line-list textareas with the Phase 1 pattern; add list reorder up/down/DnD.
- Articles: same textarea fix; verify cover image picker + tags work; verify category dropdown sourced from existing articles' distinct categories.

## Phase 5 — Home page editor + site pages

The `home_sections` table already exists with `section_key + enabled + content jsonb + sort_order`. Today `admin/design/index.tsx` is 669 lines (already comprehensive). Remaining work:

- Audit each section type and ensure it has a panel: hero, stats, services, projects, articles, testimonials, FAQ, CTA.
- Section-level enable/disable toggle that surfaces on the visitor home page.
- Section reorder (sort_order).
- "Featured" selectors that pick from existing rows (projects/services/articles/testimonials) instead of free text.
- `admin/design/about` and `admin/design/contact` finish: SEO fields, social links list with the Phase 1 textarea pattern.

---

## Out of scope (will surface if discovered, won't fix here)

- Rebuilding the visitor site or changing brand/identity.
- Migrating to a different rich-text editor (current is plain textarea — adequate for Arabic RTL once Enter/Space bugs are fixed).
- Email notifications for content changes.

---

## Which order?

Recommend executing in numbered order — Phase 1 (typing bug) is the smallest and most painful for daily use. Reply with a phase number (or "all in order") and I'll start.
