# Admin Operations System — Plan

Scope: admin pages only. No changes to visitor UI, home, services, projects, or articles. No data deletion. Preserve current RLS/roles.

## 1. Database additions (one migration)

New tables:

- `request_notes` — internal notes per service_request
  - `request_id` (fk service_requests), `author_id` (fk auth.users), `body` text
- `request_status_history` — audit trail of status changes
  - `request_id`, `from_status`, `to_status`, `changed_by`, `note`
- `customer_notes` — internal notes per customer (profile)
  - `profile_id`, `author_id`, `body`

Modifications:
- `appointments`: add `service_request_id uuid` nullable (link appointment ↔ request). Do not remove existing columns.

RLS: admin + staff can read/write all rows; service_role full. No anon access. GRANTs to authenticated + service_role.

## 2. Requests page (`/admin/requests`)

Rebuilt as an operations center:

- Filters bar: search (name/phone), type, status, city, date range, sort newest.
- Status counter chips: جديد / تم التواصل / بانتظار معلومات / تم إرسال عرض / تم الاعتماد / مكتمل / ملغي.
- Desktop: dense table (name, phone, type, city, source, status, created, updated, actions).
- Mobile: compact cards (not large).
- Quick actions per row: عرض / واتساب / تغيير حالة (dropdown).
- Empty/null values display "غير محدد".

Status enum already supports needed values — will add missing ones if any (e.g. `awaiting_info`, `contacted`, `completed`, `cancelled`) without removing existing values.

## 3. Request details page (`/admin/requests/$id`)

New route. Sections:

- **معلومات العميل**: name, phone, city, neighborhood, preferred contact method.
- **تفاصيل الطلب**: type, source, description, tank type, place type, budget, dimensions, liters, has existing tank, wants maintenance, preferred contact time.
- **الصور والمرفقات**: gallery with lightbox; broken images hidden.
- **الإدارة الداخلية**: status, internal notes log, status history, created/updated, assigned staff (if exists).
- **أزرار سريعة**: WhatsApp, copy phone, copy summary, change status, add note, schedule appointment.

WhatsApp message: pre-filled greeting with customer name + request type. Disabled with tooltip if phone missing.

Copy summary: formatted Arabic text, "غير محدد" for missing fields.

Add note: textarea + save → inserts into `request_notes`; full log shown with timestamps; never overwrites.

Status change: dropdown with confirm; writes to `service_requests.status` + `request_status_history`; disables button while saving; toast on success.

Schedule appointment: modal with date, time, type (معاينة/صيانة/تركيب/اتصال), notes. Saves to `appointments` with `service_request_id` linking back. Appears in appointments page and inside request details.

## 4. Appointments page (`/admin/appointments`)

Rebuilt:
- Tabs: قادمة / سابقة.
- Filters: date, type, status, search (name/phone).
- Card/table per appointment: customer name, type, date, time, city, status, linked request, WhatsApp, edit, cancel.
- Statuses: مجدول / تم التأكيد / مكتمل / ملغي / لم يتم.

## 5. Customers page (`/admin/customers`)

New list page (built from `profiles` + aggregates):
- Search by name/phone, filter by city.
- Per row: name, phone, city, request count, tank count, view, WhatsApp.

## 6. Customer details page (`/admin/customers/$id`)

New route:
- **بيانات العميل**: name, phone, email, city, neighborhood, created.
- **أحواض العميل**: list with view + add tank.
- **طلبات العميل**: all linked requests with status + view.
- **مواعيد العميل**: upcoming + past.
- **ملاحظات داخلية**: list + add (from `customer_notes`).
- **أزرار سريعة**: WhatsApp, create request, schedule appointment, add tank.

## 7. Mobile UX

- No giant cards, no horizontal scroll, readable typography.
- Visitor WhatsApp floating button already hidden in admin (existing).
- Images sized & lazy; broken images replaced with placeholder.

## 8. Permissions (unchanged behavior)

- admin: full.
- staff: manage requests, appointments, customers, notes.
- editor/viewer/customer: no access (existing `_authenticated` + role guard on admin layout).
- Will reuse existing `has_role` checks; no role schema change.

## Technical notes

- Server functions in `src/lib/admin-ops.functions.ts` using `requireSupabaseAuth` middleware + role check via `has_role`.
- Helpers in `src/lib/format.ts` (`displayOrFallback`, `formatSummary`, `waLink`).
- New routes: `_authenticated/admin.requests.$id.tsx`, `_authenticated/admin.customers.tsx`, `_authenticated/admin.customers.$id.tsx`. Existing `admin.requests.tsx` and `admin.appointments.tsx` rebuilt in place.
- All Supabase reads via TanStack Query (`ensureQueryData` + `useSuspenseQuery`).
- All mutations via `useMutation` → invalidate keys.

## Out of scope

- Email notifications.
- Visitor site changes.
- New roles / permission schema rewrite.
- Bulk operations.
