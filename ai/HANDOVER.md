# TOM Handover

## Project Summary
TOM (The Outreach Machine) is an internal ADAPT platform for managing delegate acquisition campaigns. It runs 5-step email outreach sequences to senior executives, inviting them to ADAPT events. Built with Next.js App Router, Supabase (auth + Postgres + Realtime), React, Tailwind.

---

## Recent Changes

### Session: 2026-06-18 (Rep Scoping)

#### Database migration (`supabase/migrations/005_rep_scoping.sql`)
**Not yet run — must be applied manually in Supabase Dashboard → SQL Editor.**

Changes:
- `public.is_admin()` helper function (replaces repeated inline EXISTS subquery)
- `profiles.display_name TEXT` — backfilled from `raw_user_meta_data`; trigger updated to capture on signup
- `profiles` SELECT policy widened to all authenticated (needed for rep avatars and AssignReps modal)
- `prospects.assigned_to UUID REFERENCES auth.users(id)` — backfilled from parent campaign's `user_id`
- New table `campaign_assignments (id, campaign_id, user_id, assigned_at)` — RLS: all SELECT; admin-only INSERT/DELETE; seeded with existing campaign owners
- New table `rep_campaign_settings (id, campaign_id, user_id, sequence_delays jsonb, email_templates jsonb, created_at, updated_at)` — RLS: own row only (SELECT/INSERT/UPDATE); admins can SELECT all
- `prospects` RLS replaced: SELECT scoped to assigned campaigns; INSERT requires `assigned_to = auth.uid()` and campaign assignment; UPDATE/DELETE require ownership or admin

#### Server actions (`app/campaigns/[id]/actions.ts`)
- `insertProspects` — removed `requireAdmin()`, now sets `assigned_to: userId` on every row; any assigned rep can import
- `toggleProspectPaused`, `moveProspectToStep`, `bulkMoveToStep`, `bulkPause`, `saveCustomEmail`, `saveProspectCustomDelay` — all downgraded from admin-only to `requireAuth()` (RLS enforces ownership server-side; bulk ops silently ignore non-owned rows)
- `deleteProspect` — NEW; any authenticated user can delete their own prospect (RLS enforces)
- `saveCampaignTemplate` — kept admin-only; writes to `campaigns.email_templates` (campaign defaults)
- `saveRepTemplate` — NEW; any authenticated user; upserts `rep_campaign_settings.email_templates` for the current user
- `saveRepDelays` — NEW; any authenticated user; upserts `rep_campaign_settings.sequence_delays`
- `assignRep` / `unassignRep` — NEW; admin-only; insert/delete rows in `campaign_assignments`
- `lib/require-admin.ts` — added `requireAuth()` helper (auth check without role check)

#### Page components
- `app/campaigns/page.tsx` — staff see only their assigned campaigns (filter via `campaign_assignments`); fetches rep profiles for avatar stack; passes `accessError` prop; accepts `searchParams`
- `app/campaigns/[id]/page.tsx` — access guard: unassigned staff redirected to `/campaigns?error=not_assigned`; fetches `rep_campaign_settings` for current user; fetches `profiles` map (admin only) for rep names; passes `currentUserId`, `repDelays`, `repSettings`, `profilesMap`, `visibleProspects` to tab components

#### UI components
- `CampaignsClient.tsx` — "Campaigns" heading (was "My Campaigns"); rep avatar stack column in table; yellow access-error banner if `?error=not_assigned`; empty state message updated for staff
- `CampaignHeaderActions.tsx` — "Assign Reps" button (admin-only); "Add Prospects" now visible to all (not just admin)
- `AssignRepsModal.tsx` (NEW) — admin modal listing all staff profiles with checkbox per rep; immediate optimistic toggle calling `assignRep`/`unassignRep`
- `SequenceTab.tsx` — new props: `currentUserId`, `repDelays`, `profilesMap`; checkboxes and bulk actions now visible to all (RLS enforces); pause/resume visible to prospect owner or admin; DayGapBox `isAdmin` → `canEdit` (owner or admin); EmailModal edit button gated by `canEdit`; rep badge shown per row (admin view); `mergedBaseDelays` = campaign defaults + rep overrides
- `ProspectDrawer.tsx` — new props: `currentUserId`; stage dropdown, Trigger Next Step, Delete button gated by `canAct = isAdmin || assigned_to === currentUserId`; delete shows inline confirm dialog calling `deleteProspect`
- `SettingsTab.tsx` — new prop: `repSettings`; admin saves to `campaigns.email_templates` via `saveCampaignTemplate`; staff save to `rep_campaign_settings` via `saveRepTemplate`; button label and description differ by role; initial editor content: admin loads campaign default, staff loads rep override with fallback
- `lib/types.ts` — added `assigned_to` to `Prospect`; `assignedReps` to `CampaignWithStats`; new `RepCampaignSettings` and `Profile` interfaces

---

## Files Touched (this session)
```
new:      supabase/migrations/005_rep_scoping.sql
new:      app/campaigns/[id]/components/AssignRepsModal.tsx
modified: lib/types.ts
modified: lib/require-admin.ts
modified: app/campaigns/page.tsx
modified: app/campaigns/[id]/page.tsx
modified: app/campaigns/[id]/actions.ts
modified: app/campaigns/components/CampaignsClient.tsx
modified: app/campaigns/[id]/components/CampaignHeaderActions.tsx
modified: app/campaigns/[id]/components/SequenceTab.tsx
modified: app/campaigns/[id]/components/ProspectDrawer.tsx
modified: app/campaigns/[id]/components/SettingsTab.tsx
modified: ai/HANDOVER.md
```

---

## Current Status
Code complete. **One manual step required before rep scoping is live:**

1. **Run SQL migration** in Supabase Dashboard → SQL Editor: `supabase/migrations/005_rep_scoping.sql`
   - This will also need Realtime still enabled on `campaigns` and `prospects` tables if not done from session 004

Previously pending from session 004 (still required if not done):
- Run `supabase/migrations/004_roles_rls.sql`
- Promote admin account: `UPDATE public.profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'debesh.ghimire@adapt.com.au');`
- Enable Realtime on `campaigns` and `prospects` tables

---

## Permission Model (as built)

| Action | Admin | Staff |
|---|---|---|
| Create / delete campaigns | ✓ | ✗ |
| Edit campaign name / date / location / theme | ✓ | ✗ (read-only form) |
| Assign / unassign reps | ✓ | ✗ |
| View all campaigns | ✓ | Assigned only |
| Import prospects (CSV) | ✓ | ✓ (own `assigned_to`) |
| Delete prospects | Own or all | Own only |
| Edit email per prospect | Own or all | Own only |
| Pause/resume prospect | Own or all | Own only |
| Move prospect stage | Own or all | Own only |
| Bulk move / bulk pause | All (silently ignores non-owned) | Own only (RLS enforces) |
| Save email templates | Campaign defaults (`campaigns`) | Personal defaults (`rep_campaign_settings`) |
| View Dashboard / AI Insights | All (aggregated) | All (aggregated) |
| Export prospect CSV | ✓ | ✓ |

---

## Unresolved Issues
- **Email sending not implemented** — all email logs and sent counts are mock/deterministic data. Graph API integration (Microsoft Outlook) is planned but not started.
- **AI scoring is mocked** — ProspectsTable match scores and AIInsightsTab data are hardcoded. Salesforce integration planned.
- **Contacts / Email Templates / Connectors** nav items are disabled stubs — no functionality behind them.
- **`proxy.ts`** at root exports a middleware-shaped function but is never registered as `middleware.ts` — auth protection relies on server component checks only, not edge middleware.
- **`lib/supabase.js`** — legacy unused client, can be deleted.
- **`startProspectSequence` / `bulkStartSequences` / `saveSequenceDelays`** — server actions exist but have no UI trigger.

---

## Next Recommended Task
**Wire up the Microsoft Graph API for email sending.** The sequence editor and prospect tracking UI are complete; the missing piece is dispatching emails and capturing replies. Entry point: `app/campaigns/[id]/actions.ts` — add a `sendEmail(prospectId, stepKey)` action that calls Graph API and updates `prospects.status` and `prospects.sent_at`.
