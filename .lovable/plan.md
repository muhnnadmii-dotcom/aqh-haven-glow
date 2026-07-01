## Goal

Allow the admin to attach more than one file to an invoice/quote in the finance module, matching the behavior already used on income/expense rows.

## Findings

- **Income/expense rows already support multi-file uploads.** `src/components/finance/RowAttachmentControl.tsx` opens a dialog whose file input is `multiple`, and it loops `uploadOneAttachment` over every selected file. No change needed there — will just verify UX after the quote work.
- **Quotes/invoices have no attachments UI today.** `src/routes/_authenticated/admin.finance.quotes.$id.tsx` has no attachment code, and the `finance_related_type` enum only allows `income | expense | supplier`, so the existing `finance_attachments` table cannot store quote files as-is.

## Plan

### 1. Database migration
- Add `'quote'` to the `public.finance_related_type` enum.
- Update `public.finance_refresh_attachment_status()` so the `quote` branch is a no-op (quotes have no `attachment_status` column to sync — just skip the UPDATE for that type instead of erroring).
- No new table, no new bucket: reuse `finance_attachments` + the private `finance-attachments` storage bucket that already backs income/expense uploads.

### 2. Reusable attachments panel for quotes
- Add an "المرفقات" card at the bottom of the quote builder page (`admin.finance.quotes.$id.tsx`), visible only after the quote is saved (i.e. when `id !== "new"`).
- Reuse `AttachmentsPanel` from `src/components/finance/AttachmentsPanel.tsx` with `relatedType="quote"` and `relatedId={id}`. It already supports:
  - Selecting multiple files at once (`<input multiple>`).
  - Uploading each file via `uploadOneAttachment` in a loop.
  - Listing existing attachments with download and delete actions and per-file "attachment type" tagging.
- Show a small hint above the panel: "احفظ الفاتورة أولاً قبل إرفاق الملفات" when `isNew`, then reveal the panel after first save.

### 3. Permissions
- Access control is handled by the existing RLS on `finance_attachments` (admin / finance roles). No new policy needed since we're only widening the enum, not the policy expression.

### 4. Verification
- Open an existing quote → attach 3 mixed files (PDF + images) in one go → confirm all appear in the list, can be downloaded, and can be individually deleted.
- Confirm income/expense rows still let the user pick and upload multiple files in a single dialog action.

## Technical notes

- Migration touches: `finance_related_type` enum, `finance_refresh_attachment_status` function.
- Frontend touches: `src/routes/_authenticated/admin.finance.quotes.$id.tsx` (import + render `AttachmentsPanel`).
- No changes to storage buckets, RLS policies, or the row-level attachment control.
