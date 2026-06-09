# Supabase Storage — RLS policies

Operational note for the `pms-media` bucket. Documents the policies we
rely on and the manual fixes for the upload failure you saw on the
new-expense page:

> فشل الرفع: new row violates row-level security policy
> ("Upload failed: new row violates row-level security policy")

---

## Why this happens

Every upload from the browser goes through Supabase Storage's RLS. The
existing policies on the `pms-media` bucket allow uploads under specific
top-level folders only (the folders that were created when the bucket
was first set up: `properties/`, `units/`, `id-documents/`, `tenant-photos/`,
etc.). The new-expense form uploads to `expenses/{timestamp}-…`, which the
existing policies don't match — so the policy check fails with the
error above.

We have two parallel fixes:

1. **Code-side (already in this commit):** receipt is now optional, so
   submitting an expense works without an upload. The form no longer
   blocks on `receipts.length === 0`, the API stops requiring
   `receiptImage`, and the Prisma column is nullable.
2. **Database-side (manual — you need to apply this in Supabase):** add a
   policy that allows authenticated users to upload to the `expenses/`
   folder. See SQL below.

---

## The SQL fix — paste in the Supabase SQL editor

Open the Supabase dashboard → SQL Editor → New query → paste and run:

```sql
-- Allow any authenticated user to upload receipts under expenses/...
create policy "Authenticated users can upload to pms-media expenses"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'pms-media'
    and (storage.foldername(name))[1] = 'expenses'
  );

-- Allow them to read their uploads back
create policy "Authenticated users can read pms-media expenses"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'pms-media'
    and (storage.foldername(name))[1] = 'expenses'
  );

-- Allow them to delete (used by the X-button on the upload thumbnail)
create policy "Authenticated users can delete pms-media expenses"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'pms-media'
    and (storage.foldername(name))[1] = 'expenses'
  );
```

After running this, the new-expense receipt upload will succeed without
the RLS error and you can mark receipts as required again if you want.

### Scoping by organization (recommended hardening)

The policies above let any authenticated user write to the entire
`expenses/` folder. For multi-tenant safety, scope each user to their own
organization's subfolder. Two steps:

1. **Change the upload path** in
   `app/dashboard/expenses/new/SubmitExpenseForm.tsx`:
   ```ts
   // before
   const path = `expenses/${Date.now()}-${rand}.${ext}`;
   // after — pass orgId in as a prop from the page server-side
   const path = `expenses/${organizationId}/${Date.now()}-${rand}.${ext}`;
   ```
2. **Tighten the policy** to check the path matches the user's org:
   ```sql
   alter policy "Authenticated users can upload to pms-media expenses"
     on storage.objects
     with check (
       bucket_id = 'pms-media'
       and (storage.foldername(name))[1] = 'expenses'
       and (storage.foldername(name))[2] = (
         select "organizationId"::text from public."User"
         where id = auth.uid()::text
       )
     );
   ```

Apply the same scoping to the select / delete policies.

This matches the audit's company-isolation rule (from `CLAUDE.md`: "every
table has company_id column").

---

## After applying the SQL

1. Test the upload on `/dashboard/expenses/new` — drag an image into the
   dropzone. The previously-failing flow should now succeed.
2. Optionally re-require the receipt: revert the client+server+schema
   changes in the commit that introduced this doc. (Easiest:
   `git revert <commit-sha>` then redeploy.)

---

## Database schema change (already in this commit)

The Prisma schema now declares `receiptImage` as nullable:

```prisma
model Expense {
  ...
  receiptImage   String?   // file URL — optional for now (storage RLS rollout)
  receiptImage2  String?
  ...
}
```

Push this to your database **once** after deploying:

```bash
npx prisma db push
```

(The build pipeline already runs `prisma generate`, but `db push` is
manual.) After this, the `Expense.receiptImage` column becomes `NULL`-able
and new submissions without a receipt will persist successfully.

---

## Other folders to audit

`pms-media` likely has policies for these folders (verify in the Supabase
dashboard):

| Folder | Used by |
| --- | --- |
| `properties/` | `PhotoUpload` from property edit / new pages |
| `units/` | `PhotoUpload` from unit edit / new pages |
| `id-documents/` | `TenantForm` ID document upload |
| `tenant-photos/` | (any tenant photo upload) |
| `org-logo/` | `OrgSettingsForm` logo upload |
| `expenses/` | **new — add policy per SQL above** |

If any other upload is reported as failing with the same RLS message, run
the same `create policy …` SQL with the relevant folder name in place of
`expenses`.
