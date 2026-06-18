# TOM Handover

## Project Summary
TOM (The Outreach Machine) is an internal ADAPT platform for managing delegate acquisition campaigns. It runs 5-step email outreach sequences to senior executives, inviting them to ADAPT events. Built with Next.js App Router, Supabase (auth + Postgres), React, Tailwind.

---

## Recent Changes

### Session: 2026-06-18

#### ADAPT Edge tab
- Copied `adapt-edge-appv14f.zip/index.html` → `public/edge/index.html` (served statically)
- Created `app/edge/page.tsx` — full-height iframe at `/edge/index.html`
- Added "Edge" nav link to `components/Sidebar.tsx` with `IconZap` icon and active-state highlight

#### Admin/Staff roles + data sync (commit `1c77d51`)
**Fix 1 — Roles:**
- `supabase/migrations/004_roles_rls.sql` — creates `profiles` table (`id`, `role: admin|staff`), trigger to auto-create `staff` profile on signup, updated RLS on `campaigns` and `prospects` (all authenticated users can SELECT; only admins can INSERT/UPDATE/DELETE)
- `lib/require-admin.ts` — server-side guard; called at the top of every write action
- `app/campaigns/actions.ts` + `app/campaigns/[id]/actions.ts` — `requireAdmin()` added to all 13 write functions
- `isAdmin` fetched server-side in both page components and threaded as a prop through the component tree
- Write controls hidden/disabled for staff in: `CampaignsClient`, `CampaignHeaderActions`, `CampaignDetailsForm`, `SettingsTab`, `SequenceTab` (checkboxes, pause, bulk actions, day-gap edit, EmailModal save), `ProspectDrawer` (stage dropdown + next step button), `UploadCSV` (via CampaignHeaderActions)

**Fix 2 — Data sync:**
- Removed `.eq('user_id', user.id)` filter from `app/campaigns/page.tsx` — this was the primary reason logins couldn't see each other's data
- `components/RealtimeRefresher.tsx` — client component that subscribes to `postgres_changes` on specified tables and calls `router.refresh()` on any event; mounted in `CampaignsClient` (campaigns table) and `app/campaigns/[id]/page.tsx` (campaigns + prospects tables)

---

## Files Touched (this session)
```
new:      ai/HANDOVER.md
new:      public/edge/index.html
new:      app/edge/page.tsx
new:      supabase/migrations/004_roles_rls.sql
new:      lib/require-admin.ts
new:      components/RealtimeRefresher.tsx
modified: components/Sidebar.tsx
modified: app/campaigns/page.tsx
modified: app/campaigns/[id]/page.tsx
modified: app/campaigns/actions.ts
modified: app/campaigns/[id]/actions.ts
modified: app/campaigns/components/CampaignsClient.tsx
modified: app/campaigns/[id]/components/CampaignHeaderActions.tsx
modified: app/campaigns/[id]/components/CampaignDetailsForm.tsx
modified: app/campaigns/[id]/components/SequenceTab.tsx
modified: app/campaigns/[id]/components/SettingsTab.tsx
modified: app/campaigns/[id]/components/ProspectDrawer.tsx
```

---

## Current Status
Code is complete and pushed. **Three manual steps required before the role system is live:**

1. **Run SQL migration** in Supabase Dashboard → SQL Editor: `supabase/migrations/004_roles_rls.sql`
   - If any `DROP POLICY IF EXISTS` lines error, check exact policy names in Authentication → Policies and drop manually
2. **Promote admin account** (run immediately after migration):
   ```sql
   UPDATE public.profiles SET role = 'admin'
   WHERE id = (SELECT id FROM auth.users WHERE email = 'debesh.ghimire@adapt.com.au');
   ```
3. **Enable Realtime** in Supabase Dashboard → Database → Replication → toggle on `campaigns` and `prospects` tables

---

## Unresolved Issues
- **Email sending not implemented** — all email logs and sent counts are mock/deterministic data. Graph API integration (Microsoft Outlook) is planned but not started.
- **AI scoring is mocked** — ProspectsTable match scores and AIInsightsTab data are hardcoded. Salesforce integration planned.
- **Contacts / Email Templates / Connectors** nav items are disabled stubs — no functionality behind them.
- **`proxy.ts`** at root exports a middleware-shaped function but is never registered as `middleware.ts` — auth protection relies on server component checks only, not edge middleware.
- **`lib/supabase.js`** — legacy unused client, can be deleted.

---

## Next Recommended Task
**Wire up the Microsoft Graph API for email sending.** The sequence editor and prospect tracking UI are complete; the missing piece is actually dispatching emails and capturing replies. Entry point: `app/campaigns/[id]/actions.ts` — add a `sendEmail(prospectId, stepKey)` action that calls Graph API and updates `prospects.status` and `prospects.sent_at`.
