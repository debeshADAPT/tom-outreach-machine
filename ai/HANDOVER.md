# TOM Handover

## Project Summary
TOM (The Outreach Machine) is an internal ADAPT platform for managing delegate acquisition campaigns. It runs 5-step email outreach sequences to senior executives, inviting them to ADAPT events. Built with Next.js App Router, Supabase (auth + Postgres + Realtime), React, Tailwind.

---

## Session: 2026-06-18 — Rep Scoping (committed + pushed, Vercel deployed)

### What changed
Multi-rep support across the full stack. Previously one user owned a campaign; now multiple staff reps can be assigned, each working their own slice of prospects independently.

**Database** (`supabase/migrations/005_rep_scoping.sql` — **NOT YET RUN**):
- `is_admin()` SQL helper function
- `profiles.display_name` — denormalised from `user_metadata.full_name`; trigger populates on signup
- `prospects.assigned_to uuid` — backfilled from parent campaign's `user_id`
- `campaign_assignments` table — admin-managed; seeds existing campaign owners; RLS: all SELECT, admin INSERT/DELETE
- `rep_campaign_settings` table — per-rep `sequence_delays` + `email_templates` jsonb; RLS: own row only (admins SELECT all)
- Prospects RLS replaced: SELECT scoped to assigned campaigns; INSERT requires `assigned_to = auth.uid()`; UPDATE/DELETE require ownership or admin

**Server actions** (`app/campaigns/[id]/actions.ts`):
- New: `deleteProspect`, `saveRepTemplate`, `saveRepDelays`, `assignRep`, `unassignRep`
- Downgraded from admin-only → `requireAuth()`: `insertProspects`, `toggleProspectPaused`, `moveProspectToStep`, `bulkMoveToStep`, `bulkPause`, `saveCustomEmail`, `saveProspectCustomDelay` (RLS enforces ownership; bulk ops silently skip non-owned rows)
- `lib/require-admin.ts`: added `requireAuth()` helper

**Pages**:
- `app/campaigns/page.tsx` — staff filtered to assigned campaigns only; rep avatar stacks; `?error=not_assigned` banner
- `app/campaigns/[id]/page.tsx` — unassigned staff redirect to `/campaigns?error=not_assigned`; threads `currentUserId`, `repDelays`, `repSettings`, `profilesMap`, `visibleProspects` to tabs

**UI components**:
- `CampaignsClient.tsx` — rep avatar stack column; access-error banner; staff empty state
- `CampaignHeaderActions.tsx` — "Assign Reps" button (admin); "Add Prospects" open to all
- `AssignRepsModal.tsx` *(new)* — checkbox list of staff with optimistic toggle
- `SequenceTab.tsx` — `canEdit = isAdmin || assigned_to === currentUserId`; rep badge per row (admin only); merged delays (campaign defaults + rep overrides)
- `ProspectDrawer.tsx` — stage controls + delete gated by `canAct`; delete shows inline confirm
- `SettingsTab.tsx` — admin saves to `campaigns.email_templates`; staff saves to `rep_campaign_settings`

**Types** (`lib/types.ts`): `Prospect.assigned_to`, `CampaignWithStats.assignedReps`, new `RepCampaignSettings` and `Profile` interfaces

### Files touched
```
new:      supabase/migrations/005_rep_scoping.sql
new:      app/campaigns/[id]/components/AssignRepsModal.tsx
new:      ai/ACTION_INVENTORY.md
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
```

---

## Current Status

Code complete and deployed. **Feature is not live until the SQL migration is run.**

**Mandatory manual steps (in order):**
1. Run `supabase/migrations/004_roles_rls.sql` (if not done)
2. Run `supabase/migrations/005_rep_scoping.sql` — Supabase Dashboard → SQL Editor
3. Promote admin: `UPDATE public.profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'debesh.ghimire@adapt.com.au');`
4. Enable Realtime on `campaigns` and `prospects` tables (if not done)

---

## Permission Model

| Action | Admin | Staff |
|---|---|---|
| Create / delete campaigns | ✓ | ✗ |
| Edit campaign details | ✓ | ✗ |
| Assign / unassign reps | ✓ | ✗ |
| View campaigns | All | Assigned only |
| Import prospects (CSV) | ✓ | ✓ (own `assigned_to`) |
| Edit / pause / move / delete prospects | All | Own only |
| Bulk actions | All (skips non-owned) | Own only (RLS) |
| Save email templates | Campaign defaults | Personal (`rep_campaign_settings`) |
| Dashboard / AI Insights | ✓ | ✓ (aggregated) |
| Export CSV | ✓ | ✓ |

---

## Unresolved Issues
- **Email sending not implemented** — email logs and sent counts are mock data. Graph API (Outlook) integration not started.
- **AI scoring is mocked** — match scores and AIInsightsTab data are hardcoded. Salesforce integration planned.
- **Contacts / Email Templates / Connectors** nav items are disabled stubs.
- **`proxy.ts`** at root is middleware-shaped but never registered as `middleware.ts` — auth relies on server component checks only.
- **`lib/supabase.js`** — legacy unused client, safe to delete.
- **`startProspectSequence` / `bulkStartSequences` / `saveSequenceDelays`** — actions exist, no UI trigger.

---

## Session: 2026-06-19 — AI Context Creator (committed + pushed, Vercel deployed)

### What changed

New top-level feature: two-phase prospect intelligence and context generation powered by the Claude API. Accessible at `/ai-context` via new sidebar nav item.

**Database** (`supabase/migrations/006_ai_context.sql` — **already run in Supabase**):
- `prospects.campaign_id` made nullable — allows context-only prospects not tied to a campaign
- Added `intelligence jsonb`, `intelligence_updated_at timestamptz`, `intelligence_status text CHECK ('pending'|'complete'|'failed')` to `prospects`
- Extended prospect SELECT + INSERT RLS policies to handle `campaign_id IS NULL` rows
- New `prospect_contexts` table with RLS (SELECT: all authenticated; INSERT: `generated_by = auth.uid()`; DELETE: owner or admin)

**Server actions** (`app/ai-context/actions.ts` — new file, `'use server'`):
- Phase 1 `runProspectIntelligence(prospectId)` — Claude `claude-sonnet-4-6` with `web_search_20250305` tool; sets `intelligence_status = 'pending'` before API call, `'complete'` or `'failed'` after
- Phase 2 `generateContext(prospectId, campaignId)` — no web search; uses stored intelligence only; inserts to `prospect_contexts`
- `bulkRunIntelligence` / `bulkGenerateContext` — sequential loops (no parallel Claude calls)
- `getAiContextProspects()` — scoped to `campaign_id IS NULL AND assigned_to = userId`
- `insertAiContextProspects(rows[])` — null campaign_id, assigned_to = userId
- `getLiveCampaigns()` — status in ('active', 'draft')
- `getProspectContextHistory(prospectId)` / `deleteContext(contextId)`

**Page** (`app/ai-context/page.tsx` — new, `'use client'`):
- Split-panel layout: left = prospect list + CSV upload + bulk actions; right = intelligence display + context history
- CSV columns: `fname`, `lname`, `job_title`, `company` (email optional)
- Intelligence status badges: No research / Researching (spinner) / Ready (green) / Failed (red)
- Per-row "Research" button with optimistic `'pending'` state
- Bulk action bar: "Research Selected" + campaign picker + "Generate Context"
- Right panel: 7-field intelligence card, campaign picker, generate button, history list with delete

**Sidebar** (`components/Sidebar.tsx`):
- New `IconSparkles` inline SVG
- "AI Context" nav item between My Campaigns and Edge; links to `/ai-context`

### Files touched
```
new:      supabase/migrations/006_ai_context.sql
new:      app/ai-context/actions.ts
new:      app/ai-context/page.tsx
modified: components/Sidebar.tsx
```

### Security constraints (permanent)
- Claude API key in `ANTHROPIC_API_KEY` env var — server-side only, never in client components
- Sequential bulk processing only — no parallel Claude API calls
- `intelligence_status` always set to `'pending'` before API call and `'complete'`/`'failed'` after
- Do not modify `RealtimeRefresher`

### Manual step still required
Enable Realtime on `prospect_contexts` in Supabase Dashboard:
- Table Editor → prospect_contexts → Enable Realtime

---

## Session: 2026-06-20 — AI Context Creator iteration (committed + pushed, Vercel deployed)

### What changed

Three rounds of fixes and improvements to the AI Context Creator.

**TypeScript / build fix** — `actions.ts` line 92 had `TS2537` on the `web_search` tool cast. Fixed with `as unknown as NonNullable<...>[number]`. This was blocking the Vercel build and is why changes weren't appearing in production.

**CSV column mapping** (`app/ai-context/page.tsx`):
- Upload now shows a mapping screen instead of importing immediately
- 5 fields: First Name *, Last Name *, Company, Job Title, LinkedIn URL
- Best-guess pre-selection (case-insensitive substring match on headers); user can override any dropdown
- "— Not mapped —" option on all non-required fields; required fields validated on confirm
- "Confirm & Import" inserts using confirmed mapping; list replaced (not appended) after insert

**Phase 1 research prompt** (`app/ai-context/actions.ts`):
- LinkedIn URL sent first with "treat as primary identifier and ground truth" instruction
- Added: "If you cannot confidently identify this specific individual, say so clearly in each field"
- `confidence_score` (1–5 integer) added to JSON output structure and `ProspectIntelligence` type
- Displayed as colour-coded badge in intelligence panel (green ≥4, amber =3, red ≤2)

**`linkedin_url` column** (`supabase/migrations/007_linkedin_url.sql`):
- Column was referenced in code but never existed in DB — caused schema cache error on load
- Migration adds `linkedin_url text` to `prospects`; threaded through insert, select, and research fetch

### Files touched
```
new:      supabase/migrations/007_linkedin_url.sql
modified: app/ai-context/actions.ts
modified: app/ai-context/page.tsx
```

### Current status

Code deployed. **007 migration must be run before the page works.**

**Mandatory manual step:**
```sql
-- Supabase Dashboard → SQL Editor
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS linkedin_url text;
```

Realtime on `prospect_contexts` also still needs enabling (Table Editor → prospect_contexts → Enable Realtime).

---

## Unresolved Issues
- **Email sending not implemented** — email logs and sent counts are mock data. Graph API (Outlook) integration not started.
- **AI scoring is mocked** — match scores and AIInsightsTab data are hardcoded. Salesforce integration planned.
- **Contacts / Email Templates / Connectors** nav items are disabled stubs.
- **`proxy.ts`** at root is middleware-shaped but never registered as `middleware.ts` — auth relies on server component checks only.
- **`lib/supabase.js`** — legacy unused client, safe to delete.
- **`startProspectSequence` / `bulkStartSequences` / `saveSequenceDelays`** — actions exist, no UI trigger.
- **AI Context Creator — no deduplication on insert** — uploading the same CSV twice creates duplicate prospect rows. No unique constraint on (assigned_to, full_name, company).

---

## Next Recommended Task
**Microsoft Graph API email sending.** The sequence UI is complete; the gap is dispatching emails and capturing replies. Add `sendEmail(prospectId, stepKey)` in `app/campaigns/[id]/actions.ts` — calls Graph API, updates `prospects.status` and `prospects.sent_at`. Replies can be polled or webhoooked into a `/api/graph/webhook` route that sets `status = 'replied'`.
