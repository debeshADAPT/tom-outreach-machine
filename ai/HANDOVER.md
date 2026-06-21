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

## Session: 2026-06-20 — Events Hub (code complete, not yet deployed)

### What changed

New top-level feature: Events Hub introduces `events` as the parent entity for all campaigns. Admins create events (EDGE or Roundtable), scrape content briefs from URLs via Claude, and assign reps — each assignment auto-creates a campaign linked to that rep and event. AI Context Creator now uses event briefs instead of campaign text.

**Database** (`supabase/migrations/008_events_hub.sql` — **run manually in Supabase**):
- `events` table: id, sf_identifier (UNIQUE), event_type, date, location, url_main/speakers/agenda, brief (jsonb), brief_status, brief_updated_at, created_by, created_at
- `event_changelog` table: id, event_id (FK cascade), changed_by, changed_at, change_type, detail (jsonb)
- `campaigns.event_id` — nullable FK to events (existing orphaned campaigns unaffected)
- `campaign_assignments.event_id` — nullable FK to events (tracks event-level assignment origin)
- `prospect_contexts.event_id` — nullable FK to events (additive; existing campaign_id stays)
- RLS: events SELECT = authenticated; INSERT/UPDATE/DELETE = is_admin()

**Server actions** (`app/events/actions.ts` — new file, `'use server'`):
- `createEvent(formData)` — inserts event, sets brief_status='pending' if URLs provided, fires-and-forgets `runScrape()`, logs 'created'
- `scrapeEventBrief(eventId)` / `resyncEventBrief(eventId)` — both call internal `runScrape()`: sets pending, archives previous brief to changelog, fetches URLs (graceful on failure), calls Claude `claude-sonnet-4-6` (no web search), writes structured JSON brief
- `updateEvent(eventId, data)` — admin-only field update
- `assignRepToEvent(eventId, userId)` — creates campaign (name=sf_identifier), inserts campaign_assignment, logs 'rep_assigned'; rolls back campaign on assignment failure
- `unassignRepFromEvent(eventId, userId)` — deletes assignment, orphans campaign (does not delete it), logs 'rep_unassigned'
- `getEvents()` — all events ordered by date asc, with assignedReps joined
- `getEventById(eventId)` — full event + changelog + assignedReps

**Pages** (new):
- `app/events/page.tsx` — server component; isAdmin pattern; renders `EventsClient`
- `app/events/components/EventsClient.tsx` — client component; two sections (EDGE / Roundtable); event cards; CreateEventModal; Resync Brief buttons
- `app/events/[id]/page.tsx` — server component; isAdmin pattern; 404 on missing event; renders `EventDetailClient`
- `app/events/[id]/components/EventDetailClient.tsx` — client component; Event Info (admin editable / staff read-only); Brief display (all states including polling when pending); Assigned Reps modal (inline, same checkbox pattern as AssignRepsModal); Changelog with expandable previous-brief

**AI Context Creator** (`app/ai-context/actions.ts`, `app/ai-context/page.tsx`):
- `generateContext(prospectId, eventId)` — signature changed from campaignId; loads event brief; new Phase 2 prompt uses both prospect intelligence and event brief; inserts to `prospect_contexts` with `event_id` (not `campaign_id`)
- `bulkGenerateContext(prospectIds, eventId)` — same signature change
- `ProspectContext` type: added `event_id: string | null`
- Page: swapped campaign picker for event picker (shows `sf_identifier`); imports `getEvents` from `../events/actions`

**Sidebar** (`components/Sidebar.tsx`):
- New `IconCalendar` inline SVG
- "Events Hub" nav item inserted **above** My Campaigns (first item in nav)
- `isEventsActive = pathname.startsWith('/events')` active state

### Files touched
```
new:      supabase/migrations/008_events_hub.sql
new:      app/events/actions.ts
new:      app/events/page.tsx
new:      app/events/components/EventsClient.tsx
new:      app/events/[id]/page.tsx
new:      app/events/[id]/components/EventDetailClient.tsx
modified: app/ai-context/actions.ts
modified: app/ai-context/page.tsx
modified: components/Sidebar.tsx
```

### Security constraints (permanent)
- Claude API key in `ANTHROPIC_API_KEY` env var — server-side only
- `brief_status` always set to `'pending'` before scrape and `'complete'`/`'failed'` after
- Admin-only mutations enforced via `requireAdmin()` in all event write actions
- Do not modify `RealtimeRefresher`

### Current status

Code complete. **008 migration must be run before Events Hub works.**

**Mandatory manual step:**
Run `supabase/migrations/008_events_hub.sql` in Supabase Dashboard → SQL Editor.

---

## Session: 2026-06-21 — Events Hub brief scraper improvement

### What changed

Improved HTML content extraction in `runScrape()` so the brief scraper captures structured data from ADAPT event pages rather than dumping raw HTML at Claude.

**`app/events/actions.ts`** — three new pure helper functions inserted between `fetchUrlContent` and `buildBriefPrompt`:

- `decodeEntities(str)` — decodes `&amp;`, `&lt;`, `&nbsp;`, `&#nnn;` etc. so speaker names arrive clean
- `stripTags(html)` — strips all HTML tags and decodes entities, collapses whitespace
- `extractStructuredContent(html)` — three-pass extraction returning `{ meta, headings, body }`:
  - **Meta tags**: scans every `<meta>` for `property="og:*"` and `name="description"`, handles any attribute ordering
  - **Headings**: `<h1>`–`<h3>` with backreference to ensure matching close tag; strips inner tags
  - **Body**: `<p>` tags (deduplicated via Set, filtered at 15 chars minimum) plus any element whose `class` contains `speaker`, `agenda`, `session`, `topic`, or `bio`

`buildBriefPrompt` now calls `extractStructuredContent` per URL and formats the result as three labelled blocks:
```
--- Meta Tags ---
--- Page Headings ---
--- Page Content ---
```

Per-URL character limit increased from 8,000 to 12,000 (applied to the extracted body text, not raw HTML).

### Files touched
```
modified: app/events/actions.ts
```

---

## Session: 2026-06-21 — Sidebar profile, Events Hub bug fixes, User Management, Edit display name

### What changed

**Sidebar user profile indicator** (`components/Sidebar.tsx`):
- Fetches `display_name` + `role` from `public.profiles` using the Supabase browser client
- Two-phase auth pattern: auth subscription clears profile on sign-out; pathname-triggered `tryFetch()` re-fetches on every navigation (catches post-login redirect, resolves "..." shown after login)
- Expanded: avatar circle (red=admin, grey=staff) + display_name + role badge. Collapsed: avatar with tooltip.
- Sign-out switched to client-side `supabase.auth.signOut()` + `router.push('/login')` (fixes wrong-user bug after account switch)
- Admin-only "Users" nav item added (`IconUsers` SVG, links to `/users`)

**Events Hub bug fixes**:
- **Rep names not showing**: PostgREST cannot traverse `campaign_assignments.user_id → auth.users → public.profiles`. Fixed with two-step query in both `getEvents()` and `getEventById()`: fetch assignments → collect unique user_ids → query profiles → build map.
- **Admin duplicate campaigns**: `Campaign` type had no `event_id`. Added field, threaded through `campaigns/page.tsx`, implemented `groupAndSort()` in `CampaignsClient` grouping campaigns by event_id with expand/collapse rows.
- **Ghost rep rows after unassign (EventDetailClient)**: `useState + useEffect([initialEvent.assignedReps])` was resetting local state after every `router.refresh()` (new array reference = effect fires = old data restored). Replaced with an **exclusion set** (`removedRepIds`): rendered list is always `initialEvent.assignedReps.filter(r => !removedRepIds.has(r.user_id))`. Server refresh can never undo an optimistic removal.
- **Ghost rep rows in Campaigns expanded groups**: orphaned campaigns (rep unassigned but campaign kept) still had `event_id` set, so they appeared as blank sub-rows. Fixed: filter `c.assignedReps.length > 0` before rendering `RepCampaignRow`. Also fixed `repCount` badge to use `group.allReps.length` (unique assigned reps) not `group.campaigns.length` (which counted orphans).

**User Management page** (admin-only, `/users`):
- `lib/supabase-admin.ts` — service-role client (bypasses RLS), server-side only
- `app/users/actions.ts` — `getUsers()` (joins profiles + auth.admin.listUsers for email + confirmed status), `inviteUser()` (inviteUserByEmail + profile upsert), `revokeUser()` (self-revoke guard + deleteUser), `updateDisplayName()` (admin-gated, updates profiles via admin client)
- `app/users/page.tsx` — server component; redirects non-admins to /campaigns
- `app/users/components/UsersClient.tsx` — Admins + Staff sections; `InviteModal` (name/email/role); `RevokeModal` (confirmation, self-revoke blocked); `UserRow` with inline display name editing

**Edit display name** (`app/users/components/UsersClient.tsx`):
- Pencil icon appears on hover next to display name (turns brand red on hover)
- Click → input pre-filled with current name; `Enter` saves, `Escape` cancels
- Avatar initials preview draft value while editing
- No-op guard: if name unchanged, cancel instead of hitting server
- Save: calls `updateDisplayName()` server action; on success shows "✓ Saved" for 1.5 s then `router.refresh()`; on error shows inline red message below input

### Files touched
```
new:      lib/supabase-admin.ts
new:      app/users/actions.ts
new:      app/users/page.tsx
new:      app/users/components/UsersClient.tsx
modified: components/Sidebar.tsx
modified: lib/types.ts
modified: app/campaigns/page.tsx
modified: app/campaigns/components/CampaignsClient.tsx
modified: app/events/actions.ts
modified: app/events/[id]/components/EventDetailClient.tsx
```

### Current status

All code committed and pushed. Deploying to Vercel. No new migrations required.

---

## Session: 2026-06-21 — Build fix and bug fixes

### What changed

**Vercel build fix** (`app/events/[id]/components/EventDetailClient.tsx` line 307):
- `hasPrevBrief` was typed as `false | unknown` because `entry.detail?.previous_brief` returns `unknown` (jsonb). TypeScript rejected it in JSX as not assignable to `ReactNode`. Fixed with `!!` coercion to `boolean`.

**AI Context Creator — context history always empty** (`app/ai-context/actions.ts`):
- `getProspectContextHistory` used `.select('*, profiles(display_name)')`. PostgREST cannot traverse `prospect_contexts.generated_by → auth.users → public.profiles` because `auth` schema is outside PostgREST's scope. The broken embed caused the query to return a 400 error, `data` was null, and history always returned `[]` — even when rows existed in the DB. Fixed with two-step query: fetch rows first, collect unique `generated_by` IDs, query `profiles` separately, merge.

**Event changelog author names always missing** (`app/events/actions.ts`):
- `getEventById` had the same broken `event_changelog.select('*, profiles(display_name)')` embed. Changelog was returned but author display names were never populated. Fixed with the same two-step pattern.

### Files touched
```
modified: app/events/[id]/components/EventDetailClient.tsx
modified: app/ai-context/actions.ts
modified: app/events/actions.ts
```

### Current status

All code committed and pushed. Deployed to Vercel. No new migrations required.

---

## Unresolved Issues
- **Email sending not implemented** — email logs and sent counts are mock data. Graph API (Outlook) integration not started.
- **AI scoring is mocked** — match scores and AIInsightsTab data are hardcoded. Salesforce integration planned.
- **Contacts / Email Templates / Connectors** nav items are disabled stubs.
- **`proxy.ts`** at root is middleware-shaped but never registered as `middleware.ts` — auth relies on server component checks only.
- **`lib/supabase.js`** — legacy unused client, safe to delete.
- **`startProspectSequence` / `bulkStartSequences` / `saveSequenceDelays`** — actions exist, no UI trigger.
- **AI Context Creator — no deduplication on insert** — uploading the same CSV twice creates duplicate prospect rows. No unique constraint on (assigned_to, full_name, company).
- **Events Hub — fire-and-forget scrape on create** — `createEvent` detaches `runScrape()` after returning. Reliable on Fluid Compute; may not complete on a cold-start termination. Resync Brief from the detail page is synchronous and always reliable.
- **Events Hub — regex-based HTML extraction** — `extractStructuredContent` uses regex, not a DOM parser. Nested tags of the same type will close early. Good enough for event pages; replace with `node-html-parser` if extraction quality degrades.
- **User Management — `SUPABASE_SERVICE_ROLE_KEY` must be set in Vercel env vars** — if missing, `/users` throws on load. Add via Vercel Dashboard → Settings → Environment Variables.
- **User Management — no role edit** — display name is editable inline but role (admin/staff) can only be changed via direct SQL. Could add a role toggle to `UserRow` if needed.

---

## Next Recommended Task
**Microsoft Graph API email sending.** The sequence UI is complete; the gap is dispatching emails and capturing replies. Add `sendEmail(prospectId, stepKey)` in `app/campaigns/[id]/actions.ts` — calls Graph API, updates `prospects.status` and `prospects.sent_at`. Replies can be polled or webhooked into a `/api/graph/webhook` route that sets `status = 'replied'`.
