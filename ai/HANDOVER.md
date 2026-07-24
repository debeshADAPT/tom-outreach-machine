# SIGNAL Handover

## Project Summary
SIGNAL is an internal ADAPT platform for managing delegate acquisition campaigns. It runs 5-step email outreach sequences to senior executives, inviting them to ADAPT events. Built with Next.js App Router, Supabase (auth + Postgres + Realtime), React, Tailwind.

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

## Session: 2026-06-21 — Full rebrand: TOM → SIGNAL with ADAPT brand overhaul

### What changed

Complete UI rebrand and visual overhaul. Every trace of "TOM / The Outreach Machine" is replaced with "SIGNAL". The visual design shifts from a soft, warm, rounded aesthetic to a sharp enterprise editorial style aligned with ADAPT's brand guidelines.

**Design tokens** (`app/globals.css`, `app/layout.tsx`):
- Full ADAPT palette as CSS vars: `#F8F8F8` body, `#E4E4E4` borders, `#E7534F` red, `#0A0A0A` black, grey scale
- Geist font (`next/font`) removed; system "Helvetica Neue", Helvetica, Arial, sans-serif applied globally
- `<title>` metadata: `"TOM – The Outreach Machine"` → `"SIGNAL"`

**Sidebar** (`components/Sidebar.tsx`):
- Background `#0A0A0A`, right border `#1C1C1C`
- "SIGNAL" all-caps wordmark with `letterSpacing: 0.18em`, fontWeight 700 — "S" always visible, "IGNAL" slides in on expand
- Active nav: `borderLeft: '2px solid #E7534F'` via `NavBorder` wrapper component — no red background fill
- Inactive nav: `#9A9A9A` text, hover `rgba(white, 6%)`
- All borders/radii tightened to 2px; profile avatar adjusted for dark theme

**Login page** (`app/login/page.tsx`):
- Background `#0A0A0A`; "SIGNAL" + "by ADAPT" all-caps wordmark; sharp-cornered inputs/button

**Campaigns** (`CampaignsClient.tsx`, `NewCampaignModal.tsx`, `campaigns/[id]/page.tsx`, `TabNav.tsx`, `ProspectsTable.tsx`, `CampaignDetailsForm.tsx`, `AIInsightsTab.tsx`, `EmailLogsTab.tsx`):
- Filter pills → underline tabs (`borderBottom: '2px solid #E7534F'`)
- All border radii: buttons/inputs/badges → 2px, modals → 4px; table containers → no radius
- Row padding tightened (14px → 10px); table header `#FAFAFA` bg, `#9A9A9A` text
- "Sent via SIGNAL" (was "Sent via TOM"); tier badge Tailwind classes → inline ADAPT styles
- `boxShadow` removed from all modals; `border: '1px solid #E4E4E4'` added instead

**Events** (`EventsClient.tsx`, `EventDetailClient.tsx`):
- Same border-radius/colour/spacing sweep; body bg `#F7F6F3` → `#F8F8F8`; borders `#E5E5E5` → `#E4E4E4`
- Grey text values aligned: `#6B7280` → `#5F5F5F`, `#9CA3AF` → `#9A9A9A`, `#0D0D0D` → `#0A0A0A`

**Users** (`UsersClient.tsx`):
- Modal radii 12px → 4px; buttons 2px; "TOM" → "SIGNAL" in confirm copy
- Same colour/border sweep as above

**AI Context** (`app/ai-context/page.tsx`):
- `TomEvent` type alias → `SignalEvent`; bg/border/radius sweep

**Name sweep** (all non-dir occurrences):
- `app/events/actions.ts`: `TOM-Bot/1.0` → `SIGNAL-Bot/1.0`
- `package.json` name: `"tom-outreach-machine"` → `"signal"`
- `ai/HANDOVER.md` + `ai/ACTION_INVENTORY.md` headings updated

### Files touched
```
modified: app/globals.css
modified: app/layout.tsx
modified: components/Sidebar.tsx
modified: app/login/page.tsx
modified: app/campaigns/components/CampaignsClient.tsx
modified: app/campaigns/components/NewCampaignModal.tsx
modified: app/campaigns/[id]/page.tsx
modified: app/campaigns/[id]/components/TabNav.tsx
modified: app/campaigns/[id]/components/ProspectsTable.tsx
modified: app/campaigns/[id]/components/CampaignDetailsForm.tsx
modified: app/campaigns/[id]/components/AIInsightsTab.tsx
modified: app/campaigns/[id]/components/EmailLogsTab.tsx
modified: app/events/components/EventsClient.tsx
modified: app/events/[id]/components/EventDetailClient.tsx
modified: app/users/components/UsersClient.tsx
modified: app/ai-context/page.tsx
modified: app/events/actions.ts
modified: ai/HANDOVER.md
modified: ai/ACTION_INVENTORY.md
modified: package.json
```

### Current status

All code committed (`c8edb1f`) and pushed to `main`. Build passes clean — zero TypeScript errors, all 13 routes compiled. Vercel will deploy automatically. No migrations required, no manual steps required.

---

## Session: 2026-06-22 — Animated login page + SIGNAL logo component

### What changed

**`components/SignalLogo.tsx`** (new):
- Animated equaliser/waveform icon: 7 vertical bars + 2 red dots, staggered CSS `@keyframes` shockwave pulse every 2s (centre fires first, radiates outward)
- Bars: grey `#9A9A9A`, centre bar red `#E7534F`; `transformOrigin: center` so bars scale from midpoint
- "SIGNAL" wordmark below — `A` floats 6px above baseline via `position: relative; bottom`, with a `2px #E7534F` underline trimmed to glyph width (`right: 0.18em` excludes trailing letter-spacing)
- `size="lg"` (animated, login page) / `size="sm"` (static)
- Keyframe: shockwave profile — near-instant rise (`cubic-bezier(0.1,0,0.2,1)`), sharp snap back, long rest; peak `scaleY(2.1)`

**`components/GlobeBackground.tsx`** (new):
- Full-viewport `<canvas>` background animation — orthographic-projected dot globe
- Grid built from explicit parallels (`-75°` to `+75°` every 15°) + 18 meridians; fill dots at cell centres (smaller, darker)
- Meridian dots skip ±1° of each parallel to prevent overlap at intersections
- Depth shading via `z`-based opacity; back-face culled (`z < 0`)
- Slow continuous spin (`SPIN_SPEED = 0.0014`); static centred position
- Resizes to viewport on `window.resize`

**`app/login/page.tsx`**:
- Globe canvas behind everything (`z-index: 0`), card at `z-index: 1`
- Card: `rgba(14,14,14,0.75)` + `backdropFilter: blur(12px)` + `1px solid rgba(255,255,255,0.06)` + `border-radius: 8px`; subtle red `box-shadow` glow on hover (`0.4s ease`)
- Fields use `placeholder` instead of labels (removes ~70px height, card closer to square)
- Button: transparent default with `rgba(255,255,255,0.15)` border, all-caps narrow tracking; fills `#E7534F` on hover (`0.2s ease`)

**`components/Sidebar.tsx`**:
- `ExpandedLogo` inline component: "SIGNAL" wordmark at 15px with floating A (same treatment as login, scaled down)
- `CollapsedWaveform` inline component: 5-bar static mini waveform; on `mouseenter` increments `pulseKey` — each bar gets `key={pulseKey-i}` forcing remount, replaying `signal-bar-once` CSS animation (iteration-count: 1, shockwave profile)
- Header area replaces the "S" + sliding "IGNAL" split with cross-fading between the two components

### Files touched
```
new:      components/SignalLogo.tsx
new:      components/GlobeBackground.tsx
modified: app/login/page.tsx
modified: components/Sidebar.tsx
```

### Current status

Committed `00a632e` and pushed to `main`. Vercel deploying automatically. No migrations required, no manual steps required.

---

## Session: 2026-06-22 — Graph API email sending plan (deferred)

### What changed

Full Azure/M365 setup checklist and implementation plan produced for Microsoft Graph API email sending. Decision made to defer pending internal Azure App Registration approval.

**Plan summary (not yet implemented):**
- `lib/graph-client.ts` — `sendMailAsUser()` via `@azure/identity` + `@microsoft/microsoft-graph-client`
- `supabase/migrations/009_send_tracking.sql` — add `last_contacted_at timestamptz`
- `app/campaigns/[id]/actions.ts` — `sendEmail(prospectId, stepKey)` server action with template resolution priority chain and DB update on success
- `app/campaigns/[id]/components/SequenceTab.tsx` — "Send now" button in EmailModal view mode (current step only)
- `lib/types.ts` — add `last_contacted_at` to `Prospect`

**Azure requirements (pending approval):**
- App Registration with `Mail.Send` application permission + admin consent
- Application Access Policy scoped to a mail-enabled security group of rep mailboxes
- Env vars: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`

**`SUPABASE_SERVICE_ROLE_KEY` confirmed set in Vercel** — `/users` page is now fully operational in production.

### Files touched
```
none (plan only — no code written this session)
```

### Current status

Plan documented. Implementation on hold pending Azure approval. No migrations required.

---

## Unresolved Issues
- **Email sending not implemented** — Graph API plan ready (see 2026-06-22 session); blocked on Azure App Registration approval.
- **AI scoring is mocked** — match scores and AIInsightsTab data are hardcoded. Salesforce integration planned.
- **Contacts / Email Templates / Connectors** nav items are disabled stubs.
- **`proxy.ts`** — In Next.js 16, `proxy.ts` at root IS the middleware (renamed from `middleware.ts`). Active on every request; checks for `auth-token` cookie. Supplements server-component auth checks.
- **`lib/supabase.js`** — legacy unused client, safe to delete.
- **`startProspectSequence` / `bulkStartSequences` / `saveSequenceDelays`** — actions exist, no UI trigger.
- **Events Hub — fire-and-forget scrape on create** — `createEvent` detaches `runScrape()` after returning. Reliable on Fluid Compute; may not complete on cold-start termination. Resync Brief is synchronous and always reliable.
- **Events Hub — regex-based HTML extraction** — `extractStructuredContent` uses regex, not a DOM parser. Replace with `node-html-parser` if extraction quality degrades.
- **User Management — no role edit** — role (admin/staff) can only be changed via direct SQL. Could add a role toggle to `UserRow` if needed.

---

## Session: 2026-06-23 — Bug fixes, cleanup, and AI Context hardening

### What changed

**Events Hub 404 on event click** (`app/events/[id]/page.tsx`):
- Root cause: page called `getEventById()` server action which created its own Supabase client, silently returning null → `notFound()` in Next.js 16.
- Fix: rewrote page to query Supabase directly with the auth client (mirrors `campaigns/[id]/page.tsx`).

**Prospect dedup on AI Context insert** (`app/ai-context/actions.ts`, `supabase/migrations/009_prospect_dedup.sql`):
- Pre-flight SELECT before insert; skips rows matching `(email, assigned_to, campaign_id IS NULL)`.
- Also filters blank rows (no name/email/company/linkedin) and deduplicates by `full_name` for email-less rows.
- Upload banner shows "N added. M duplicates skipped."
- Migration adds `UNIQUE INDEX ON prospects(email, assigned_to) WHERE email IS NOT NULL AND campaign_id IS NULL`.

**Delete prospects** (`app/ai-context/actions.ts`, `app/ai-context/page.tsx`):
- New `deleteAiContextProspects` server action (scoped to `assigned_to`, `campaign_id IS NULL`).
- Per-row × button and "Delete" in the bulk action bar for cleaning up existing duplicates.

**Remove manual campaign creation** (`app/campaigns/components/CampaignsClient.tsx`, deleted `NewCampaignModal.tsx`):
- Removed "+ New Campaign" button, `showModal` state, modal import. EmptyState directs admins to Events Hub.

**Event theme — user-entered field** (`app/events/actions.ts`, `app/events/components/EventsClient.tsx`, `app/events/[id]/components/EventDetailClient.tsx`, `app/campaigns/page.tsx`, `lib/types.ts`, `supabase/migrations/010_event_theme.sql`):
- Added `theme text` column to `events` table (migration `010_event_theme.sql`).
- Theme / Tagline field in Create Event modal and Event Info settings (editable, saves via `updateEvent`).
- Campaigns list reads `events.theme` directly instead of `brief.key_themes[0]`.

**AI Context research — prompt and parsing hardening** (`app/ai-context/actions.ts`):
- Prompt now opens and closes with explicit JSON-only instructions; null-field instruction added.
- JSON extraction uses `/\{[\s\S]*\}/` regex after stripping markdown fences — tolerates stray prose.
- `raw` hoisted above `try` so catch can log first 500 chars of Claude's actual response.

**Stuck-status fixes** (`app/ai-context/actions.ts`, `app/events/actions.ts`):
- `runProspectIntelligence`: catch block's Supabase reset wrapped in its own try/catch — a network blip on the reset can no longer leave `intelligence_status = 'pending'` forever.
- `runScrape`: `try` expanded to cover URL fetching, prompt build, and JSON parse (previously only wrapped Claude API call). Same inner try/catch pattern for the reset call. `console.error` logs event id and full error.

### Files touched
```
modified: app/events/[id]/page.tsx
modified: app/events/actions.ts
modified: app/events/components/EventsClient.tsx
modified: app/events/[id]/components/EventDetailClient.tsx
modified: app/ai-context/actions.ts
modified: app/ai-context/page.tsx
modified: app/campaigns/components/CampaignsClient.tsx
modified: app/campaigns/page.tsx
modified: lib/types.ts
new:      supabase/migrations/009_prospect_dedup.sql
new:      supabase/migrations/010_event_theme.sql
deleted:  app/campaigns/components/NewCampaignModal.tsx
```

### Current status

All code committed and deployed (`0f0b2e8` → `aaa412b`). Zero TypeScript errors; all 13 routes compile.

**Pending manual steps (Supabase Dashboard → SQL Editor):**

```sql
-- 009: prospect dedup index
CREATE UNIQUE INDEX IF NOT EXISTS prospects_email_assigned_dedup
  ON public.prospects (email, assigned_to)
  WHERE email IS NOT NULL AND campaign_id IS NULL;

-- 010: event theme column
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS theme text;

-- Unstick any prospects/events left pending from before the fix
UPDATE public.prospects SET intelligence_status = 'failed', intelligence = null
  WHERE intelligence_status = 'pending';
UPDATE public.events SET brief_status = 'failed'
  WHERE brief_status = 'pending';
```

---

## Session: 2026-06-25 — Context review (no code changes)

### What changed

Session was a context catch-up only. No code written.

### Files touched
```
none
```

### Current status

Codebase is clean. Last committed: `aaa412b` (2026-06-23). Deployed on Vercel.

**Pending manual steps** from 2026-06-23 session — confirm whether these have been run in Supabase Dashboard:
```sql
-- 009: prospect dedup index
CREATE UNIQUE INDEX IF NOT EXISTS prospects_email_assigned_dedup
  ON public.prospects (email, assigned_to)
  WHERE email IS NOT NULL AND campaign_id IS NULL;

-- 010: event theme column
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS theme text;

-- Unstick any rows left pending
UPDATE public.prospects SET intelligence_status = 'failed', intelligence = null
  WHERE intelligence_status = 'pending';
UPDATE public.events SET brief_status = 'failed'
  WHERE brief_status = 'pending';
```

---

## Unresolved Issues
- **Email sending not implemented** — Graph API plan ready (2026-06-22 session); blocked on Azure App Registration approval (`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` env vars needed).
- **AI scoring is mocked** — match scores and AIInsightsTab data are hardcoded. Salesforce integration planned.
- **Contacts / Email Templates / Connectors** nav items are disabled stubs.
- **`proxy.ts`** — In Next.js 16, this IS the middleware (active on every request, checks `auth-token` cookie). Supplements server-component auth checks.
- **`lib/supabase.js`** — legacy unused client, safe to delete.
- **`startProspectSequence` / `bulkStartSequences` / `saveSequenceDelays`** — actions exist, no UI trigger.
- **Events Hub — fire-and-forget scrape on create** — `createEvent` detaches `runScrape()`. Reliable on Fluid Compute; Resync Brief is synchronous fallback.
- **Events Hub — regex-based HTML extraction** — replace with `node-html-parser` if extraction quality degrades.
- **User Management — no role edit** — role can only be changed via direct SQL.

---

## Session: 2026-07-23 — Codebase audit + mock-data disclosure fix

### What changed

**Audit (no code changes):** Full read-only audit of dead code, half-finished features, and blocked/mocked-system assumptions. Written to `ai/AUDIT_FINDINGS.md`. Key findings: `EmailLogsTab.tsx` claimed "Sent via SIGNAL · Microsoft Graph" for emails never sent; `ProspectsTable.tsx`/`ProspectDrawer.tsx` match scores and mock replies had no in-UI disclaimer; `AIInsightsTab.tsx` presented hardcoded data as live AI recommendations; AI-Context dedup (`insertAiContextProspects`) never actually depends on migration 009's unique index (pure pre-flight SELECT, TOCTOU race regardless of migration status); Events Hub `createEvent()` → `runScrape()` fire-and-forget can still leave `brief_status`/`intelligence_status` stuck at `'pending'` forever on a hard kill, with no cron/staleness detection; `lib/supabase.js` and three orphaned sequence actions (`startProspectSequence`/`bulkStartSequences`/`saveSequenceDelays`) confirmed dead; the "Generate Context" spinner bug noted in a prior HANDOVER entry (2026-06-20/23) is **not actually present in current code** — that note was stale.

**Mock/preview data disclosure fix** (implements audit prioritized item #1 — see `ai/DECISIONS.md`):
- New `components/MockDataBadge.tsx` — shared `MockDataBanner` + `MockDataTag` components, one consistent visual pattern for flagging fake data anywhere in the app.
- `app/campaigns/[id]/components/EmailLogsTab.tsx` — added `MockDataBanner` under the header; replaced the "Sent via SIGNAL · Microsoft Graph" footer with a `MockDataTag` + "Preview only — this email has not actually been sent"; fixed misleading header/empty-state copy that asserted real send activity.
- `app/campaigns/[id]/components/ProspectsTable.tsx` — `MockDataTag` attached to every match-score badge.
- `app/campaigns/[id]/components/ProspectDrawer.tsx` — `MockDataTag` on the header match-score pill; explicit "Preview text — not an actual reply from this prospect" label above the mock reply content.
- `app/campaigns/[id]/components/AIInsightsTab.tsx` — `MockDataBanner` at the top of the tab, covering Top Matches, Industry Performance, Coverage Insights, Top Performing Topics, and the AI Insight cards.

No change to any underlying mock-data generation logic, and no other audit findings (dedup race, stuck-pending status, dead code, orphaned actions) were touched — those remain open per the audit's prioritized list.

### Files touched
```
new:      ai/AUDIT_FINDINGS.md
new:      components/MockDataBadge.tsx
modified: ai/DECISIONS.md
modified: app/campaigns/[id]/components/EmailLogsTab.tsx
modified: app/campaigns/[id]/components/ProspectsTable.tsx
modified: app/campaigns/[id]/components/ProspectDrawer.tsx
modified: app/campaigns/[id]/components/AIInsightsTab.tsx
```

### Current status

Verified manually in-browser (both empty and populated data states) on all three surfaces — banners and tags render correctly, no layout regressions. `npx tsc --noEmit` and `npm run build` both clean, all 13 routes compile. Not yet committed — awaiting user review. No migrations required, no manual steps required.

---

## Session: 2026-07-23 — Lead Discovery Phase 1: company_prospect_pool schema + upsert-pattern fix

### What changed

Schema + write-path groundwork for Lead Discovery (no Lusha integration, no new UI — those are Phase 2/3). Directly implements audit prioritized item #2 from `ai/AUDIT_FINDINGS.md` (the AI-Context dedup TOCTOU race, finding c#5) as a side effect of doing this properly before adding more write paths on top of it.

**Note:** the task brief for this phase cited `LEAD_DISCOVERY_SPEC.md` (Sections 3, 4.5) — that file does not exist anywhere in this repo. Proceeded using the column list given directly in the task brief; logged as a gap in `ai/DECISIONS.md`. If that spec exists elsewhere, it should be added to `ai/` so future sessions can find it.

**New table** (`supabase/migrations/011_company_prospect_pool.sql` — **run, confirmed applied**):
- `company_prospect_pool` — domain-keyed shared search cache for Lead Discovery. Columns: `company_domain` (normalized lowercase, indexed), `full_name`, `title`, `company_name`, `linkedin_url`, `source` (`lusha` / `csv_salesforce` / `manual`), `has_contact_info` boolean, `last_found_at`, `event_type_fit` text[], timestamps. Deliberately holds no email/phone — contact enrichment happens on promotion (a later phase), not in the pool.
- Dedup: two partial unique indexes mirroring the existing `prospects` pattern — `(company_domain, linkedin_url) WHERE linkedin_url IS NOT NULL`, falling back to `(company_domain, full_name) WHERE linkedin_url IS NULL AND full_name IS NOT NULL`.
- RLS: shared cache — SELECT/INSERT/UPDATE open to all authenticated; DELETE admin-only.

**Second dedup gap found and closed** (`supabase/migrations/012_prospect_name_dedup.sql` — **run, confirmed applied**):
- While building the upsert refactor below, found the *name-only* fallback branch of `insertAiContextProspects` (CSV rows with no email) had **zero DB-level constraint** — unlike the email branch, which at least had migration 009. Added a partial unique index `prospects_fullname_assigned_dedup` on `(full_name, assigned_to) WHERE full_name IS NOT NULL AND email IS NULL AND campaign_id IS NULL`, same shape as 009. Logged separately in `ai/DECISIONS.md` since this is a new finding, not something the audit or task brief called out.

**Upsert-pattern fix** (`supabase/migrations/013_prospect_upsert_rpc.sql`, `lib/upsert.ts`, `app/ai-context/actions.ts` — **run, confirmed applied**):
- Both 009 and 012 are *partial* unique indexes. Postgres requires `ON CONFLICT` to repeat a partial index's `WHERE` predicate verbatim to use it as an arbiter — and PostgREST's upsert mechanism (all `supabase-js`'s `.upsert()` can drive) has no way to supply that predicate, so a bare `.upsert({ onConflict: 'email,assigned_to' })` would fail against `prospects_email_assigned_dedup`. This was flagged and confirmed before any code was written (see `ai/DECISIONS.md`).
- New `upsert_context_prospects(p_rows jsonb)` Postgres function — `SECURITY INVOKER` (existing RLS still applies), does the real `INSERT ... ON CONFLICT (...) WHERE <matching predicate> DO UPDATE ... RETURNING id, (xmax = 0) AS inserted` per row, for both the email and name-only branches.
- New `lib/upsert.ts` (`upsertViaRpc`) — thin, reusable TS wrapper any future write path (pool write-back, promotion — Phase 2/3) should call the same way, each with its own matching RPC.
- `insertAiContextProspects` (`app/ai-context/actions.ts`) rewritten to call `upsertViaRpc` instead of the old pre-flight-SELECT-then-insert. Behavior change: a matched row now has its fields refreshed (merged) rather than being silently ignored — the returned `skipped` count means "matched and merged," not "ignored." UI copy in `app/ai-context/page.tsx` ("N added. M duplicates skipped.") was left as-is (out of scope for this phase) but is now slightly imprecise given this semantic change — worth a small copy tweak in a future pass.

**Not built this phase (by design):** pool write-back logic, promotion write path, any Lead Discovery UI, Lusha API integration. `lib/upsert.ts`'s calling convention is designed so those phases can reuse it without rework.

### Verification

Ran the concurrent-double-submit test through the app's actual UI (not a standalone script), per explicit instruction: uploaded a one-row test CSV via AI Context Creator (`ZZTest DoubleSubmit`, distinctive test email) — first upload: "1 prospect added" (8 total). Uploaded the *exact same* CSV again — result: **"0 prospects added. 1 duplicate skipped."**, count stayed at 8, no duplicate row created, no unique-violation error surfaced. This confirms the RPC's `ON CONFLICT (...) WHERE ...` clause is correctly resolving against the partial index in production, not erroring or silently duplicating. Cleaned up by deleting the test prospect via the app's own delete button (back to 7). `npx tsc --noEmit` and `npm run build` both clean.

### Files touched
```
new:      supabase/migrations/011_company_prospect_pool.sql
new:      supabase/migrations/012_prospect_name_dedup.sql
new:      supabase/migrations/013_prospect_upsert_rpc.sql
new:      lib/upsert.ts
modified: app/ai-context/actions.ts
modified: ai/DECISIONS.md
```

### Current status

Migrations 011, 012, 013 confirmed run in Supabase (user-confirmed). Code verified working against production via the double-submit test above. Not yet committed — awaiting user review.

---

## Session: 2026-07-23 — Lead Discovery Phase 2: company_prospect_pool write-back (partial — Lusha client still blocked)

### What changed

`ai/LEAD_DISCOVERY_SPEC.md` was added to the repo (separate task) between Phase 1 and this session — see its own decisions log entry. Before starting Phase 2 build, confirmed with the user: (1) Lusha server-side credentials are provisioned (user will add the real env var to `.env.local` when needed — not added yet, nothing consumes it), (2) **the spec's Section 6 Lusha response field list is confirmed wrong** — Product Decisions found the real response is nested (`jobTitle.title`, `company.name`, `company.domain`, `socialLinks.linkedin`) and Search Contacts never returns `email` at all (Enrich-only). The user is correcting the spec; **`lib/lusha-client.ts` must not be built until that correction lands** — building against a confirmed-wrong contract guarantees rework. (3) Phase 2 scope confirmed as pool write-back only, testable against manually-specified input — no target-company-list upload (that became a separate task, see next session below).

This session built only the half of Phase 2 that doesn't depend on Lusha's exact response shape:

**New migration** (`supabase/migrations/014_company_prospect_pool_upsert_rpc.sql` — **run, confirmed applied**):
- `upsert_company_prospect_pool(p_rows jsonb)` — same shape as `013_prospect_upsert_rpc.sql`: `SECURITY INVOKER`, real `INSERT ... ON CONFLICT (...) WHERE ... DO UPDATE ... RETURNING id, (xmax = 0) AS inserted` per row, targeting `company_prospect_pool`'s two partial indexes from `011`. Refreshes `last_found_at` to `now()` on every successful write (insert or update) — the field the 60-day staleness check reads.

**New TS wrapper** (`lib/prospect-pool.ts` — new file):
- `writeToProspectPool(supabase, rows)` — thin call to `upsertViaRpc(supabase, 'upsert_company_prospect_pool', rows)`. This is the exact row shape a future `lib/lusha-client.ts` needs to produce once unblocked — no rework needed here regardless of the corrected field mapping.
- `lib/upsert.ts`'s `upsertViaRpc` was widened from `Record<string, unknown>[]` to a generic `<T extends object>[]` so callers like `ProspectPoolRow` (a plain interface, no index signature) can pass rows without a cast — a small, backward-compatible type fix, not a behavior change.

**Not built this session:** `lib/lusha-client.ts` itself (HTTP call, auth, response parsing) — still blocked. `LUSHA_API_KEY` env var not added — nothing consumes it yet.

### Files touched
```
new:      supabase/migrations/014_company_prospect_pool_upsert_rpc.sql
new:      lib/prospect-pool.ts
modified: lib/upsert.ts
```

### Current status — STILL OPEN, carried into next session

- **Migration 014 is confirmed run** (verified via direct query against Supabase — `upsert_company_prospect_pool` exists). Correction: an earlier version of this note said it hadn't been run yet; that was inaccurate — it had been, just not communicated at the time.
- **The `upsert_company_prospect_pool` RPC had not yet been exercised end-to-end** as of this session — no double-write verification test had been run against it (unlike 013, which was verified through the app's actual UI). Re-flagged in the next session below; closed out in the session after that (see further down).
- `npx tsc --noEmit` and `npm run build` both clean as of this session.

---

## Session: 2026-07-23 — Lead Discovery Phase 3, part 1: manager target-company-list upload

### What changed

Manager (admin)-facing upload of an event's target company list (~300 companies typical), tagged with which rep(s) own each company — per `ai/LEAD_DISCOVERY_SPEC.md` Section 2, steps 2-4. Does not depend on Lusha — confirmed the spec's Sections 3/6 have **still not been corrected** as of this session (checked directly, not assumed), so `lib/lusha-client.ts` remains unbuilt.

**Scoping decision:** scoped to `event_id`, not an individual `campaign_id` — confirmed with the user before building. In this codebase a "campaign" is rep-scoped (`assignRepToEvent()` creates one `campaigns` row per rep per event), so a per-campaign list would mean re-uploading the same company list once per rep on a shared event. One list per event, split by rep ownership, matches how everything else Lead-Discovery-adjacent is scoped (`prospect_contexts.event_id`) and puts the UI in Events Hub alongside Assigned Reps / Brief / Changelog. "Manager" maps to this app's existing `admin` role — no new role introduced.

**New migration** (`supabase/migrations/015_event_target_companies.sql` — **written, NOT yet run**):
- `event_target_companies` — `event_id` FK, `company_name`, `company_domain` (CHECK `= lower(company_domain)`, matching `011`'s normalization exactly so the two systems key consistently later), `created_by`, `created_at`. `UNIQUE (event_id, company_domain)` — a **plain** (non-partial) unique index, so a normal `supabase-js` `.upsert()` works fine here; no RPC needed (the partial-index-needs-an-RPC pattern in `ai/DECISIONS.md` doesn't apply to this table).
- `event_target_company_reps` — many-to-many junction (`target_company_id`, `user_id`), since a company can have more than one owning rep per the spec's "rep(s)".
- RLS: SELECT open to all authenticated; INSERT/UPDATE/DELETE admin-only, same pattern as `campaign_assignments`.

**Server actions** (`app/events/actions.ts`):
- New `TargetCompany` type.
- `getTargetCompanies(eventId)`, `uploadTargetCompanies(eventId, rows)` (admin-only, plain `.upsert()` on `(event_id, company_domain)`), `setCompanyReps(targetCompanyId, userIds)` (admin-only, replace-all junction rows), `removeTargetCompany(targetCompanyId)` (admin-only).

**UI** (`app/events/[id]/components/TargetCompaniesSection.tsx` — new; wired into `EventDetailClient.tsx` between Assigned Reps and Changelog; `app/events/[id]/page.tsx` fetches companies + owner-rep-ids server-side, same two-step-join style already used for rep names):
- CSV upload + column-mapping screen, following `app/ai-context/page.tsx`'s mapping-screen pattern (not the older fixed-header `UploadCSV.tsx` pattern) — arbitrary CSV, map Company Name / Company Domain columns via dropdown, "Confirm & Import".
- Per-company inline rep-tagging via toggle pills, scoped to the event's already-assigned reps only (not all staff).
- Admin-only — the whole section renders `null` for non-admins, same convention as the existing Assigned Reps section (hidden, not read-only, until a rep-facing consumer of this data exists in a later phase).

**Explicitly not built** (per task brief): Lusha calls, "Find new leads" flow, already-in-list/new split, promote/discard — all future work once `lib/lusha-client.ts` is unblocked.

### Files touched
```
new:      supabase/migrations/015_event_target_companies.sql
new:      app/events/[id]/components/TargetCompaniesSection.tsx
modified: app/events/actions.ts
modified: app/events/[id]/components/EventDetailClient.tsx
modified: app/events/[id]/page.tsx
modified: ai/DECISIONS.md
```

### Current status

`npx tsc --noEmit` and `npm run build` both clean. Migration 015 confirmed run. Not yet committed.

**Correction to the note above:** migration 014 was in fact confirmed run before this session started (verified via direct query — `upsert_company_prospect_pool` exists in Supabase); the "NOT yet run" note two sessions back was inaccurate, just not communicated at the time.

**Both outstanding verification passes are now complete:**

1. **014 double-write test (`upsert_company_prospect_pool`)** — ran via a one-off script (no UI exists for this yet, consistent with the approved plan): called the RPC twice with an identical test row (same `company_domain` + `linkedin_url`). First call `inserted: true`; second call, same `id`, `inserted: false`; exactly 1 matching row in the table afterward. **PASS.** Test row deleted, script removed.
2. **015 upload/tag/remove pass** — tested live in-browser as admin on event CIO30 (3 assigned reps): uploaded a 3-row test CSV via the column-mapping screen (auto-detected "Company Name"/"Domain" correctly), got "3 companies imported"; tagged two reps onto one company via the toggle pills, **reloaded the page**, confirmed both tags persisted (not just optimistic client state); removed one company via ×, confirmed count dropped to 2; removed the remaining two, confirmed empty state returned. **PASS.** All test data removed via the UI's own controls, nothing left in the database.

**Still genuinely open (unrelated to either migration):**
- **`lib/lusha-client.ts` still blocked** — `ai/LEAD_DISCOVERY_SPEC.md` Sections 3/6 have not been corrected in the repo as of this session (checked directly: still shows the old `id/linkedinUrl/email/firstName/lastName/companyName/companyDomain/has/canReveal` field list). Do not build against it.

---

## Checkpoint: 2026-07-24 — no new work, pre-restart save point

Session paused for a laptop restart. Nothing built or changed in this checkpoint — recording exact state so the next session (or a crash-recovered one) can pick up cleanly.

**Repo state:** working tree clean except `ai/TASK_CURRENT.md` (empty, untracked, harmless — has been present and unused across multiple recent sessions). `main` is even with `origin/main` — nothing local, nothing unpushed. Last commit: `e02de55` ("feat: Lead Discovery Phase 3 (part 1) — event-scoped target company list").

**What's live in Supabase as of this checkpoint:** migrations through `015_event_target_companies.sql`, all confirmed run and verified — `009`/`012` (prospect dedup, email + name-only), `011` (`company_prospect_pool`), `013` (`upsert_context_prospects` RPC), `014` (`upsert_company_prospect_pool` RPC), `015` (`event_target_companies` + `event_target_company_reps`). See the two sessions immediately above for how `014` and `015` were each verified end-to-end.

**Still open, unchanged from the "Next Recommended Task" this checkpoint replaces:**
- **`lib/lusha-client.ts` blocked** — `ai/LEAD_DISCOVERY_SPEC.md` Sections 3/6 still have the old, confirmed-wrong Lusha field list as of the last direct check. Verify again before assuming it's been corrected — don't rely on this checkpoint note alone once time has passed.
- Once unblocked, Phase 3's rep-facing "Find new leads" flow (already-in-list/new split, promote/discard) can build on `014`'s pool and `015`'s target-company/rep-ownership data together.
- Per the 2026-07-23 audit's prioritized list (`ai/AUDIT_FINDINGS.md`), the stuck-`pending` staleness check for `brief_status`/`intelligence_status` (item #3) is still open.
- Email sending via Graph API remains blocked on Azure App Registration approval (`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`).

---

## Session: 2026-07-24 — `lib/lusha-client.ts` attempt paused: API key returns 0 results on real domains

### What happened

`ai/LEAD_DISCOVERY_SPEC.md` Sections 3/6's field-schema correction was confirmed already applied to the repo this session (nested `V3ContactPreview` shape, no `email` at discovery — see `ai/DECISIONS.md`), so `lib/lusha-client.ts` build work started. `LUSHA_API_KEY` was added to `.env.local` for the first time this session.

Before writing the client's request-mapping code, the actual Lusha Prospecting Search API contract was checked against a live call (docs.lusha.com is JS-rendered and unreadable via automated fetch, so this was verified directly against the API instead of guessed):

- **Endpoint confirmed:** `POST https://api.lusha.com/prospecting/contact/search`, auth via `api_key` header.
- **Request shape confirmed correct per Lusha's own docs** (cross-checked via search-indexed doc snippets): `filters.companies.include.domains: [domain]`, `pages: { page, size }` with `size` minimum 10.
- **Problem found:** every successful (2xx) call — contact search by domain, company search by domain, company search by company name "Microsoft" — returned `totalResults: 0, data: [], billing.creditsCharged: 0`, including for `microsoft.com`, a domain far too large to plausibly have zero prospecting matches. This is not a request-shape bug (the shape is accepted and confirmed correct); it points to the API key/contract not being entitled for prospecting search server-side access — exactly the open item already flagged in spec Section 6 ("confirm whether the existing Lusha contract/account supports server-side API key access... may need to be provisioned or confirmed with Lusha/IT before build starts").

**Paused here per the user's direction:** this is an account/entitlement question for Lusha/IT to resolve, not something resolvable by further guessing at request shapes. No further live calls were made once this was identified.

### Status

`lib/lusha-client.ts` is **not written** — paused before any client code was committed, since building parsing/mapping logic against an unverified-working key would risk the same rework problem the earlier field-schema blocker caused. The debug test script used to probe the API (`scripts/lusha-test.mjs`) was deleted; nothing from this session is committed.

**Blocking Phase 2 completion:** need confirmation from Lusha/IT that this API key (or a replacement) has prospecting search access enabled for server-side use, before `lib/lusha-client.ts` can be built and verified end-to-end (field mapping, staleness check, write-back) as the task brief requires.

### Files touched
None (test script created and removed within this session; no committed changes).

---

## Session: 2026-07-24 — `lib/lusha-client.ts` built and verified — Lead Discovery Phase 2 complete

### What changed

The previous session's "entitlement" theory was wrong. Root cause of the earlier 0-result problem: the endpoint called (`/prospecting/contact/search`) was simply the wrong one — it silently accepted requests and returned zero results instead of erroring. The correct V3 endpoint is **`POST /v3/contacts/prospecting`**, confirmed via Lusha's docs (fetched as raw markdown — the rendered page is JS-only and unreadable directly) and then verified live. Full details of every shape correction (nested `pagination`, required non-empty filters, the full seniority-ID enum used to make the required contact filter a no-op, response key `results` not `data`, `location` object) are in `ai/DECISIONS.md`'s matching entry — not repeated here.

**`lib/lusha-client.ts`** (new): `discoverCompanyContacts(supabase, companyDomain, options?)` —
1. Checks `company_prospect_pool` for the domain's freshest `last_found_at`; if <60 days old (spec Section 3), returns cached rows with no Lusha call.
2. If stale/absent, calls `POST /v3/contacts/prospecting` with the domain filter and the full seniority-ID enum (a required, deliberately non-narrowing filter — see `ai/DECISIONS.md`).
3. Maps each result to the pool's flat schema — `full_name`, `title`, `company_name`, `linkedin_url`, `location`; `has_contact_info` always `false` and no `email`/phone field ever touched, per the field-schema correction.
4. Writes via the existing `writeToProspectPool` → `upsertViaRpc('upsert_company_prospect_pool', ...)` path (never a plain insert).
5. Reads back and returns the written rows, plus `source: 'lusha' | 'cache'` and `totalFound`.

Throws (does not silently return empty) on missing `LUSHA_API_KEY`, any non-2xx Lusha response, or any Supabase error — callers can't mistake a real failure for "no contacts found."

**New migration** (`supabase/migrations/016_company_prospect_pool_location.sql` — **written and run this session**): adds `company_prospect_pool.location jsonb` and re-creates the `014` upsert RPC to also write it. Spec addition (Lusha's response includes per-contact location, not in the original Section 6 field list, captured now since it's free at discovery time) — not a scope deviation, logged in `ai/DECISIONS.md`.

**Types**: `lib/types.ts` gained `CompanyProspectPoolRow` (the full DB row shape, for reads); `lib/prospect-pool.ts`'s `ProspectPoolRow` (write-input shape) gained an optional `location` field.

### Verification

Tested against real Lusha credentials via a temporary Next.js route handler (`app/api/lusha-test/route.ts`, deleted after use — not committed, kept the diff to only the four files below):
- First call (`adapt.com.au`, page size 10) hit Lusha live, correctly mapped and wrote 10 real ADAPT contacts to `company_prospect_pool` (spot-checked via the route's JSON response) — no `email`/phone field present anywhere, `location` populated, `has_contact_info: false` on every row.
- Second call, same domain, returned `source: "cache"` with `totalFound: null` — confirmed the staleness check skips a second live Lusha call within the 60-day window, no additional credits spent.
- Total session credit spend: 2/100 (per the user's own Lusha dashboard) — for the one real 10-result search call.
- **The real ADAPT rows written during verification were kept** (user's explicit choice) rather than deleted — legitimate discovery-stage data for ADAPT's own domain, not synthetic test rows.

### Files touched
```
new:      lib/lusha-client.ts
new:      supabase/migrations/016_company_prospect_pool_location.sql
modified: lib/types.ts
modified: lib/prospect-pool.ts
modified: ai/DECISIONS.md
```

### Current status

`npx tsc --noEmit` clean. Migration 016 confirmed run. Committed and pushed as `de8f8c4` ("feat: Lead Discovery Phase 2 — Lusha Search Contacts client + pool write-back").

**Lead Discovery Phase 2 (Lusha client + pool write-back) is now fully complete.**

---

---

## Checkpoint: 2026-07-24 — Lead Discovery status summary, session break

No new work in this checkpoint — consolidating current status across all four Lead Discovery phases before a session break, so the next session (or a crash-recovered one) doesn't have to reconstruct it from scattered session entries above.

**Latest commit:** `de8f8c4` ("feat: Lead Discovery Phase 2 — Lusha Search Contacts client + pool write-back"). **Confirmed pushed** — `git log origin/main` matches local `HEAD` exactly (`de8f8c4`), verified via `git fetch origin` this session. Working tree clean except `ai/TASK_CURRENT.md` (empty, untracked, harmless — present and unused across multiple recent sessions, same as noted in the 2026-07-24 pre-restart checkpoint above).

**Lead Discovery phase status:**
- **Phase 1 — schema + upsert pattern: DONE.** Migrations `011`-`013`. `company_prospect_pool` schema (011), name-based dedup gap closed (012), RPC-based atomic upsert (013) — Supabase's built-in `.upsert()` can't target the partial unique indexes this table needs (`ai/DECISIONS.md`, 2026-07-23).
- **Phase 2 — Lusha client + pool write-back: DONE.** `lib/lusha-client.ts` (`discoverCompanyContacts`): 60-day staleness check against `company_prospect_pool`; if stale, calls `POST /v3/contacts/prospecting` live; maps the nested response (`jobTitle.title`/`seniority`, `company.name`/`domain`, `socialLinks.linkedin`, `location`) to the pool's flat schema; writes via the existing `upsertViaRpc` path. Migration `016` added `location jsonb` (a real spec addition — the data is free from the API response, capturing it now rather than having to re-query later). No email/phone is ever captured — Lusha's Prospecting endpoint doesn't return them; that data only exists behind the Enrich endpoint, which SIGNAL must never call server-side (spec Section 5).
  - **Root-cause note for history:** earlier sessions hit what looked like a Lusha account/entitlement problem — real calls against real domains (including `microsoft.com`) returned 0 results and 0 credits charged. The actual root cause was a **wrong endpoint** (`/prospecting/contact/search`, which isn't a valid V3 path) silently accepting requests instead of erroring. The correct endpoint, confirmed via live docs and test calls, is `POST /v3/contacts/prospecting`. There was never an entitlement issue.
  - **Verified end-to-end:** a real call against `adapt.com.au` returned real ADAPT contacts (2/100 credits charged per the user's own Lusha dashboard); a second call against the same domain served from cache with no additional Lusha call/credits. The real ADAPT rows written during verification were **intentionally kept** in `company_prospect_pool` (user's explicit choice) — legitimate data, not test residue; deleting them would just force a wasteful re-fetch later.
- **Phase 3, part 1 — event-scoped target-company upload: DONE.** Migration `015` (`event_target_companies` + `event_target_company_reps` junction), manager-facing CSV upload with per-company rep tagging, in the Event Detail page.
- **Phase 3, part 2 — rep-facing "Find new leads" UI: NOT STARTED.** Now fully unblocked — the Lusha client exists and is verified working. Covers spec Section 2, steps 4-9: a search button scoped to one of the rep's owned companies (via `event_target_companies`/`event_target_company_reps`), split into "Already in your list" vs. "New" using the matching hierarchy (Section 4.1/4.2), promote/discard actions, and the cross-rep passive pursuit flag.
- **Phase 4 — CSV reconciliation logic: NOT STARTED.** Covers spec Section 4.3-4.5: LinkedIn-URL auto-merge on CSV upload, name+company fallback match requiring explicit rep confirmation via side-by-side comparison (never auto-merge), ambiguous-match escalation to manager/admin, and updating the pool's `has_contact_info` flag on successful merge.

**Other open items, unrelated to Lead Discovery (unchanged, still standing):**
- The 2026-07-23 mock-data UI disclosure fix (`EmailLogsTab`, match-score badges, `AIInsightsTab`) is **done and committed** — confirmed correctly reflected in this file's 2026-07-23 session entry and not re-flagged as open anywhere later in this file. Note this fixed *disclosure* only — the underlying data (AI scoring, email sending) is still genuinely mocked/unimplemented, which is why those items correctly remain listed separately under "Unresolved Issues" above.
- Per `ai/AUDIT_FINDINGS.md`'s prioritized list: the stuck-`pending` staleness check for `brief_status`/`intelligence_status` (items #1/#2) is still open — no cron/sweeper exists to detect or recover a row stuck in `'pending'` from a hard-killed process. Lower priority than Lead Discovery per the user's stated build-order preference.
- Dead code / orphaned-action cleanup (`lib/supabase.js`, unused sequence-start actions) — still open, low priority.

---

## Next Recommended Task
Lead Discovery Phase 3, part 2 (the rep-facing "Find new leads" UI) is the immediate next build — see the checkpoint above for full scope. Phase 4 (CSV reconciliation logic) is the task after that, and should follow directly once Phase 3 part 2 lands, since promotion (Phase 3) and CSV reconciliation (Phase 4) both write into the same `prospects`/pool surfaces and are easiest to reason about back-to-back. Until either is picked up, the stuck-`pending` staleness check (audit items #1/#2) is available work that doesn't depend on Lead Discovery.
