# TOM — Complete User-Facing Action & Route Inventory

_Generated: 2026-06-18_

---

## 1. CAMPAIGN ACTIONS

| Action | What it does | Component / File | Read / Write |
|---|---|---|---|
| **New Campaign button** | Opens `NewCampaignModal` | `CampaignsClient.tsx` · `app/campaigns/components/` | — |
| **Create Campaign (form submit)** | Inserts new row into `campaigns` (name, theme, event_date, location, status=draft) | `NewCampaignModal.tsx` → server action `createCampaign` | **WRITE** (admin-only) |
| **Empty-state "New Campaign" button** | Same — second entry point when list is empty | `CampaignsClient.tsx` (EmptyState) | — |
| **Click campaign row** | Navigates to `/campaigns/[id]` | `CampaignsClient.tsx` (CampaignRow) | READ (nav) |
| **Campaign Settings cog ⚙️** | Opens slide-in panel with `CampaignDetailsForm` | `CampaignHeaderActions.tsx` · `app/campaigns/[id]/components/` | — |
| **Save (campaign details form)** | Updates `campaigns` row: name, theme, event_date, location, event_brief | `CampaignDetailsForm.tsx` → `updateCampaign` | **WRITE** (admin-only) |
| **Status badge** | Read-only display of draft / active / completed | `CampaignsClient.tsx`, `app/campaigns/[id]/page.tsx` | READ |
| **Filter pills** (All / Active / Draft / Completed) | Client-side filter; no Supabase call | `CampaignsClient.tsx` | READ (local) |

> **Not implemented:** No delete, duplicate, or archive campaign action exists anywhere.

---

## 2. PROSPECT ACTIONS

| Action | What it does | Component / File | Read / Write |
|---|---|---|---|
| **Prospects ▾ button** | Opens dropdown: "Add Prospects" + "Export Campaign Data" | `CampaignHeaderActions.tsx` | — |
| **Add Prospects** (dropdown item) | Opens `ImportModal` → `UploadCSV` (admin-only) | `CampaignHeaderActions.tsx` | — |
| **Upload CSV (file picker)** | User selects `.csv`; parsed client-side | `UploadCSV.tsx` · `app/campaigns/[id]/components/` | READ (local parse) |
| **SF confirmation checkbox** | Confirms Salesforce export excludes Active Cycle contacts before upload proceeds | `UploadCSV.tsx` | — |
| **Confirm & Continue** | Calls `checkDuplicates` (reads `prospects`), then proceeds or shows dupe warning | `UploadCSV.tsx` → `checkDuplicates` | READ |
| **Skip Duplicates & Continue** | Filters dupes, calls `insertProspects` | `UploadCSV.tsx` → `insertProspects` | **WRITE** (admin-only) |
| **Export Campaign Data** | Fetches all prospects, generates CSV, triggers browser download | `CampaignHeaderActions.tsx` → `exportCampaignData` lib | READ |
| **Search (Prospects tab)** | Filters rows by name / company / title; no Supabase call | `ProspectsTable.tsx` | READ (local) |
| **Search (Sequence tab)** | Filters sequence rows by name / company / email | `SequenceTab.tsx` | READ (local) |
| **Prospect row click (Sequence tab)** | Opens `ProspectDrawer` side panel | `SequenceTab.tsx` | READ (local) |
| **Checkbox (per-prospect, Sequence tab)** | Selects prospect for bulk actions (admin-only) | `SequenceTab.tsx` | — |
| **Stage dropdown (ProspectDrawer)** | Changes `sequence_step` on the prospect row | `ProspectDrawer.tsx` → `moveProspectToStep` | **WRITE** (admin-only) |
| **Trigger Next Step → (ProspectDrawer)** | Advances prospect to next sequence step | `ProspectDrawer.tsx` → `moveProspectToStep` | **WRITE** (admin-only) |

> **Not implemented:** No individual prospect add / edit / delete form. Prospects are only created via CSV import.

---

## 3. SEQUENCE ACTIONS

| Action | What it does | Component / File | Read / Write |
|---|---|---|---|
| **Pause/Resume ⏸/▶ (per-prospect)** | Toggles `paused` flag on prospect row | `SequenceTab.tsx` (admin-only) → `toggleProspectPaused` | **WRITE** (admin-only) |
| **Move to step ▾ (bulk action bar)** | Bulk-moves selected prospects to a chosen step | `SequenceTab.tsx` (admin-only) → `bulkMoveToStep` | **WRITE** (admin-only) |
| **Pause selected (bulk action bar)** | Sets `paused = true` on all selected prospects | `SequenceTab.tsx` (admin-only) → `bulkPause` | **WRITE** (admin-only) |
| **Clear (bulk action bar)** | Deselects all; no Supabase call | `SequenceTab.tsx` | — |
| **Step pill click** | Opens `EmailModal` to view/edit email for that step | `SequenceTab.tsx` (StepPills) | READ (local) |
| **Section headers (expand/collapse)** | Toggles grouped prospect section open/closed | `SequenceTab.tsx` | READ (local) |
| **Day gap box (inline edit, +Xd between steps)** | Updates `custom_delays` on prospect for gap between two steps | `SequenceTab.tsx` (DayGapBox, admin-only) → `saveProspectCustomDelay` | **WRITE** (admin-only) |
| **Sequence step rows in ProspectDrawer** | Click opens `EmailModal` for that step | `ProspectDrawer.tsx` | READ (local) |
| **Start sequence / Bulk start** | Server actions `startProspectSequence` + `bulkStartSequences` exist but **no UI button is wired to them** | `app/campaigns/[id]/actions.ts` | **WRITE** — orphaned, no UI trigger |

---

## 4. EMAIL ACTIONS

| Action | What it does | Component / File | Read / Write |
|---|---|---|---|
| **Edit button (EmailModal)** | Switches from view → edit mode (admin-only) | `SequenceTab.tsx` (EmailModal) | — |
| **Subject line input (EmailModal edit mode)** | Edits email subject locally | `SequenceTab.tsx` (EmailModal) | — |
| **Rich text body editor (EmailModal)** | TipTap WYSIWYG; toolbar: B/I/U/Link/Bullet/Numbered/Font-size | `SequenceTab.tsx` (EmailModal) | — |
| **Load template ▾ (EmailModal)** | Dropdown of 5 step templates to load into the editor | `SequenceTab.tsx` (EmailModal) | READ (local static) |
| **Replace (template confirm dialog)** | Replaces editor content with selected template | `SequenceTab.tsx` (EmailModal) | READ (local) |
| **Save changes (EmailModal)** | Persists custom subject + HTML body to `prospects.custom_emails[stepKey]` | `SequenceTab.tsx` (EmailModal) → `saveCustomEmail` | **WRITE** (admin-only) |
| **Copy email (EmailModal view mode)** | Copies resolved body text to clipboard | `SequenceTab.tsx` (EmailModal) | — |
| **Edit/Collapse (SettingsTab template card)** | Expands/collapses campaign-level template editor per step | `SettingsTab.tsx` (admin-only) | — |
| **Subject input (SettingsTab template card)** | Edits campaign default subject for a step | `SettingsTab.tsx` | — |
| **Rich text body editor (SettingsTab template card)** | Same TipTap editor for campaign-level default body | `SettingsTab.tsx` | — |
| **Save template (SettingsTab)** | Saves campaign default template to `campaigns.email_templates[stepKey]` | `SettingsTab.tsx` → `saveCampaignTemplate` | **WRITE** (admin-only) |
| **Email log row click** | Expands row to show full rendered email (Outlook-style header + body) | `EmailLogsTab.tsx` | READ (mock data) |
| **Copy email (Email Logs row)** | Copies email body text to clipboard | `EmailLogsTab.tsx` | — |
| **Column sort headers (Email Logs)** | Sorts by date / prospect / company / subject / status | `EmailLogsTab.tsx` | READ (local) |
| **Search (Email Logs tab)** | Filters logs by prospect name / company / subject | `EmailLogsTab.tsx` | READ (local) |
| **Follow-up button (AI Insights → Top Matches)** | Visually present but no `onClick` handler wired | `AIInsightsTab.tsx` | *UI stub* |

> **Not implemented:** No "Send" or "Schedule send" button. Actual email dispatch via Microsoft Graph is not built. All email log data is mock/generated.

---

## 5. DASHBOARD / REPORTING

| Action | What it does | Component / File | Read / Write |
|---|---|---|---|
| **Overview tab** | KPI cards (Total Prospects, Contacted, Replies, Positive Replies, High Intent), Campaign Momentum sparkline, Campaign Funnel, Sequence Performance table, Reply Sentiment donut, Sequence Health gauge, Action Center — **all mock data** | `OverviewTab.tsx` | READ (mock; campaign + prospects fetched by page server component) |
| **"View Top Matches →"** | Navigates to `?tab=ai-insights` | `OverviewTab.tsx` (CampaignFunnel) | READ (nav) |
| **"View full sequence analytics →"** | Navigates to `?tab=sequence` | `OverviewTab.tsx` (SequencePerformance) | READ (nav) |
| **"View all replies →"** | Navigates to `?tab=prospects&filter=replied` | `OverviewTab.tsx` (ReplySentiment) | READ (nav) |
| **"View health details →"** | Navigates to `?tab=sequence` | `OverviewTab.tsx` (SequenceHealth) | READ (nav) |
| **Action Center item links** | Each navigates to a relevant tab | `OverviewTab.tsx` (ActionCenter) | READ (nav) |
| **AI Insights tab** | Top Matches, Industry Performance, Coverage tier pie chart, Top Performing Topics, 6 AI Insight cards — **all mock data** | `AIInsightsTab.tsx` | READ (mock only) |

---

## 6. SETTINGS / CONFIG

| Action | What it does | Component / File | Read / Write |
|---|---|---|---|
| **Settings tab (campaign)** | Lists all 5 sequence email templates; expand/edit/save per template | `SettingsTab.tsx` | READ (loads `campaigns.email_templates`) |
| **Save template** | Writes updated template to `campaigns.email_templates` | `SettingsTab.tsx` → `saveCampaignTemplate` | **WRITE** (admin-only) |
| **Campaign Settings panel (cog ⚙️)** | Slide-in form: name / theme / event date / location / event brief | `CampaignHeaderActions.tsx` + `CampaignDetailsForm.tsx` | READ then WRITE |
| **Sign Out button** | Calls `signOut`; invalidates Supabase session, redirects to `/login` | `Sidebar.tsx` → `signOut` | **WRITE** (auth session) |
| **Collapse/Expand sidebar toggle** | Toggles sidebar width; persists to `localStorage` | `Sidebar.tsx` | READ/WRITE (localStorage) |
| **Expand/collapse recent campaigns (chevron)** | Toggles sub-list of 5 most recently visited campaigns | `Sidebar.tsx` | — |
| **Contacts nav item** | Disabled stub — "Coming soon" tooltip, no handler | `Sidebar.tsx` | *Stub* |
| **Email Templates nav item** | Disabled stub — "Coming soon" tooltip | `Sidebar.tsx` | *Stub* |
| **Connectors nav item** | Disabled stub — "Coming soon" tooltip | `Sidebar.tsx` | *Stub* |

---

## 7. NAVIGATION ROUTES

| Route | Page / Component | Requires write permission? | Notes |
|---|---|---|---|
| `/` | `app/page.tsx` | No | Immediately redirects to `/campaigns` |
| `/login` | `app/login/page.tsx` | No | Email + password sign-in |
| `/campaigns` | `app/campaigns/page.tsx` → `CampaignsClient` | No | All authenticated users see all campaigns; "New Campaign" hidden for staff |
| `/campaigns/[id]` | `app/campaigns/[id]/page.tsx` | No | Defaults to `?tab=dashboard` |
| `/campaigns/[id]?tab=dashboard` | `OverviewTab` | No | All-mock KPI + charts |
| `/campaigns/[id]?tab=ai-insights` | `AIInsightsTab` | No | All-mock AI scoring |
| `/campaigns/[id]?tab=prospects` | `ProspectsTable` | No | Read-only; mock match scores |
| `/campaigns/[id]?tab=sequence` | `SequenceTab` | **Yes** (write actions present) | Pause/resume/move/bulk — admin-only; staff can view |
| `/campaigns/[id]?tab=email-logs` | `EmailLogsTab` | No | Read-only mock log table |
| `/campaigns/[id]?tab=settings` | `SettingsTab` | **Yes** (write actions present) | Edit/save templates — admin-only; Edit button hidden for staff |
| `/edge` | `app/edge/page.tsx` | No | Iframe embedding `/edge/index.html` (ADAPT Edge tool) |
| `/contacts` | `app/contacts/page.tsx` | No | Empty stub — heading only |
| `/email-templates` | `app/email-templates/page.tsx` | No | Empty stub — heading only |
| `/connectors` | `app/connectors/page.tsx` | No | Empty stub — heading only |

---

## Summary: All Write Actions & Their Current Access Level

| Server Action | UI Trigger | Table | Currently |
|---|---|---|---|
| `createCampaign` | New Campaign form | `campaigns` INSERT | Admin-only ✓ |
| `updateCampaign` | Campaign Settings → Save | `campaigns` UPDATE | Admin-only ✓ |
| `insertProspects` | CSV Upload → Confirm | `prospects` INSERT | Admin-only ✓ |
| `toggleProspectPaused` | Pause/Resume ⏸ button | `prospects` UPDATE | Admin-only ✓ |
| `moveProspectToStep` | Stage dropdown / Trigger Next Step | `prospects` UPDATE | Admin-only ✓ |
| `bulkMoveToStep` | Bulk → Move to step | `prospects` UPDATE | Admin-only ✓ |
| `bulkPause` | Bulk → Pause selected | `prospects` UPDATE | Admin-only ✓ |
| `saveCustomEmail` | EmailModal → Save changes | `prospects` UPDATE | Admin-only ✓ |
| `saveProspectCustomDelay` | DayGapBox inline edit | `prospects` UPDATE | Admin-only ✓ |
| `saveCampaignTemplate` | SettingsTab → Save template | `campaigns` UPDATE | Admin-only ✓ |
| `startProspectSequence` | **No UI button** | `prospects` UPDATE | Admin-only — orphaned |
| `bulkStartSequences` | **No UI button** | `prospects` UPDATE | Admin-only — orphaned |
| `saveSequenceDelays` | **No UI button** | `campaigns` UPDATE | Admin-only — orphaned |
| `signOut` | Sign Out button | auth session | All users |

**What staff can currently do:** view all campaigns and all tabs, export prospect CSV, copy email body to clipboard, search/filter within any tab, expand/collapse UI sections. All Supabase writes are blocked server-side by `requireAdmin()`.
