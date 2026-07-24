# SIGNAL — Decisions Log

## 2026-07-23 — Mock/preview data must always carry a visible in-UI indicator

**Decision:** Any screen that displays fabricated/placeholder data (not backed by a live integration) must show a visible "Preview" indicator directly in the UI — never rely on a source-code comment alone. Established a shared pattern: `components/MockDataBadge.tsx` exports `MockDataBanner` (full-width banner, used at the top of a mocked view or tab) and `MockDataTag` (small inline pill, attached directly to an individual fake value like a score badge or generated text).

**Why:** Audit findings (c#1–c#3 in `ai/AUDIT_FINDINGS.md`, 2026-07-23) found three screens — Email Logs, Prospects/Prospect Drawer match scores + mock replies, and AI Insights — presenting completely fabricated data with zero in-UI disclosure. The worst case: `EmailLogsTab.tsx` literally read "Sent via SIGNAL · Microsoft Graph" for emails that were never sent, since no Graph API integration exists. A rep, stakeholder, or demo viewer could reasonably have believed real send/scoring/reply activity had occurred.

**How to apply:** Any future placeholder/mock feature (e.g. a new analytics widget before its real data source is wired up, a demo/sample-data mode) must use `MockDataBanner`/`MockDataTag` from `components/MockDataBadge.tsx` rather than inventing a new visual treatment or relying on a comment-only disclaimer. This applies retroactively too — if a "mock data" comment exists in code without a matching in-UI indicator, that's now considered incomplete, not acceptable-as-is.

**Implemented in this pass:**
- `EmailLogsTab.tsx` — banner under the header, "Preview only — this email has not actually been sent" replacing the "Sent via SIGNAL · Microsoft Graph" footer, and honest empty/populated-state copy.
- `ProspectsTable.tsx` + `ProspectDrawer.tsx` — `MockDataTag` on every match-score badge; explicit "Preview text — not an actual reply" label above the mock reply content in the drawer.
- `AIInsightsTab.tsx` — one banner at the top of the tab covering Top Matches, Industry Performance, Coverage Insights, Top Performing Topics, and the AI Insight cards.

**Explicitly deferred (not done in this pass, separate tasks):** making email sending or AI scoring real (both still blocked/mocked as of 2026-07-23), the AI-Context dedup TOCTOU race (audit c#5), the stuck-`pending` scrape/intelligence status issue (audit b#1/b#2), and the dead "Follow-up" button / orphaned sequence actions (audit prioritized item #6).

---

## 2026-07-23 — Dedup-sensitive writes must use a real atomic upsert (RPC), not PostgREST `.upsert()`, when the target constraint is a partial unique index

**Decision:** Any write path that needs to dedup against a *partial* unique index (a `CREATE UNIQUE INDEX ... WHERE ...`) must do the real `INSERT ... ON CONFLICT (...) WHERE <matching predicate> DO UPDATE ...` inside a `SECURITY INVOKER` Postgres RPC function, called through the shared `lib/upsert.ts` (`upsertViaRpc`) wrapper — not through supabase-js's `.upsert({ onConflict: ... })`. `SECURITY INVOKER` is required (not `SECURITY DEFINER`) so existing RLS policies still apply to the caller exactly as if they'd run the INSERT/UPDATE directly.

**Why:** Postgres only allows `ON CONFLICT` to target a partial unique index if the `ON CONFLICT` clause itself repeats that index's `WHERE` predicate verbatim (Postgres docs §3.19.1, "ON CONFLICT index_predicate"). PostgREST's upsert mechanism — the only thing `supabase-js`'s `.upsert()` can drive — has no way to supply that predicate, so it cannot target a partial index at all; a bare `.upsert({ onConflict: 'email,assigned_to' })` against `prospects_email_assigned_dedup` (a partial index) would fail with "no unique or exclusion constraint matching the ON CONFLICT specification." This was flagged during Lead Discovery Phase 1 (2026-07-23) before any code was written, avoiding a broken assumption from reaching production.

**How to apply:** `upsert_context_prospects` (`013_prospect_upsert_rpc.sql`) is the first of what should become a small family of per-table upsert RPCs — one per write path (CSV import now; pool write-back and promotion in later Lead Discovery phases). Each new RPC should follow the same shape: `SECURITY INVOKER`, one `INSERT ... ON CONFLICT (...) WHERE <exact index predicate> DO UPDATE ... RETURNING id, (xmax = 0) AS inserted` per row, called via `upsertViaRpc(supabase, '<rpc_name>', rows)`. If a future dedup constraint is a *plain* (non-partial) unique index, `.upsert()` would actually work fine for it — this pattern is specifically about partial indexes, not upserts in general.

**Related:** see the next entry below — a second dedup gap (name-only rows) found and closed while implementing this pattern.

---

## 2026-07-23 — Closed a second, previously-unflagged dedup gap: full_name-only prospect rows had zero DB-level constraint

**Decision/finding:** While building the upsert refactor above, found that the *name-only* fallback dedup path in `insertAiContextProspects` (for CSV rows with no email) had **no backing DB constraint at all** — unlike the email path, which at least had migration 009's partial unique index (even if the app wasn't using it correctly). The old code deduped name-only rows purely via a pre-flight `SELECT` + in-memory `Set`, meaning the TOCTOU race audit finding c#5 flagged for the email path was actually *worse* on the name-only path: there was no constraint to eventually catch a duplicate even in the best case. Added `012_prospect_name_dedup.sql`: a partial unique index on `prospects(full_name, assigned_to) WHERE full_name IS NOT NULL AND email IS NULL AND campaign_id IS NULL`, mirroring 009's shape. `upsert_context_prospects` now targets this index for the name-only branch the same way it targets 009 for the email branch.

**Why this is logged separately from the main upsert-pattern decision above:** this is a genuine, previously-unidentified gap (not called out in `ai/AUDIT_FINDINGS.md` c#5, which only discussed the email path) discovered as a side effect of this task, not something the task brief asked for directly. Worth its own record so it doesn't get miscategorized as routine cleanup.

**How to apply:** when auditing or fixing a dedup path, check *every* branch of the dedup logic for a matching DB constraint, not just the one already known to have (or lack) one — a multi-branch dedup function can have branches in different states of correctness.

---

## 2026-07-23 — Lead Discovery spec added to repo; staleness window finalized at 60 days

**Decision:** `ai/LEAD_DISCOVERY_SPEC.md` has been added to the repo, closing the gap noted during Phase 1 (both decision entries above proceeded without this file present — it existed only as a task-brief excerpt, not a committed document reps and future sessions could reference directly). The file was found on the user's local Desktop, not previously in the repo; content was written in verbatim except for two staleness-window mentions (Section 3, Section 6), which were updated per the note below.

**Staleness window finalized at 60 days** (product decision, confirmed 2026-07-23) — this was an open item in the spec ("suggest 60-90 days, confirm before build") that is now resolved and no longer blocks Phase 2. Sections 3, 6, and 7 of `ai/LEAD_DISCOVERY_SPEC.md` reflect the finalized number; the file's other open items (Lusha server-side credential provisioning, prospect dedup migration status — already confirmed run per the two entries above) remain as documented there.

**How to apply:** treat `ai/LEAD_DISCOVERY_SPEC.md` as the source of truth for Lead Discovery Phases 2-4 (Lusha integration, Lead Discovery UI, CSV reconciliation) — its matching hierarchy (Section 4.1), reconciliation logic (Section 4.3-4.4), and non-goals (Section 5) should be read directly from that file rather than re-derived from task-brief excerpts, which is exactly what caused this gap in the first place.

---

## 2026-07-23 — Lusha's real Search Contacts response shape does not match the spec's confirmed field list — `lib/lusha-client.ts` stays blocked

**Decision/finding:** Before starting Phase 2 build, confirmed with the user that `ai/LEAD_DISCOVERY_SPEC.md` Section 6's "confirmed via Lusha's V3 docs" field list (`id, linkedinUrl, email, firstName, lastName, companyName, companyDomain, has, canReveal`) is **wrong**, not just missing a title field as first suspected. Product Decisions found the real response is nested (`jobTitle.title`, `company.name`, `company.domain`, `socialLinks.linkedin`), and Search Contacts **never returns `email` at all** — that's an Enrich-only field. The spec is being corrected (Sections 3 and 6); as of this session's check, it had **not yet been updated in the repo**.

**Why this matters:** building `lib/lusha-client.ts`'s response parsing against the old field list would guarantee rework the moment the real shape was confirmed. The email point is actually reassuring for the discovery-only scope decision (Section 1/5) — it means there was never a real risk of the Search Contacts call accidentally capturing contact info — but the field *names* still need correcting before any parsing code is written.

**How to apply:** do not write `lib/lusha-client.ts` (or any code that parses a Lusha Search Contacts response) until `ai/LEAD_DISCOVERY_SPEC.md` Sections 3/6 are confirmed corrected in the repo — check directly (grep for `jobTitle` or similar), don't assume based on a prior conversation. Everything *not* dependent on the exact field shape (schema, RPC, TS wrapper taking already-normalized rows) can and should proceed in the meantime — see the Phase 2 write-back work logged in `ai/HANDOVER.md`.

---

## 2026-07-23 — Target-company list scoped to event_id, not campaign_id; "manager" maps to existing admin role

**Decision:** Lead Discovery's manager-uploaded target-company list (`ai/LEAD_DISCOVERY_SPEC.md` Section 2, steps 2-4) is scoped to `event_id` via a new `event_target_companies` table, not to an individual `campaign_id`. "Manager" in the spec is treated as this app's existing `admin` role — no new role was introduced.

**Why:** in this codebase a "campaign" is rep-scoped — `assignRepToEvent()` (`app/events/actions.ts`) auto-creates one separate `campaigns` row per rep per event, all sharing the same `event_id`. Scoping the target-company list to one `campaign_id` would mean a manager re-uploading and re-splitting the same ~300-company list once per rep working a shared event, which defeats the point of uploading it once and tagging ownership. Every other Lead-Discovery-adjacent entity in this codebase is already event-scoped (`prospect_contexts.event_id`), and there's no separate "manager" role anywhere in the existing RBAC model (`lib/require-admin.ts` only has `admin`/`staff`) — every comparable admin-adjacent write (Events Hub, Assign Reps, User Management) already uses `requireAdmin()`.

**How to apply:** any future Lead Discovery feature that needs to know "which companies is this rep responsible for" should query `event_target_companies` joined through `event_target_company_reps` by `event_id` + `user_id`, not by `campaign_id`. If a genuine "manager" role distinct from admin is ever introduced, this decision (and every other admin-gated Lead Discovery write) would need revisiting — not just this one table.

---

## 2026-07-24 — Lusha V3 field-schema correction: was missing, now applied to `ai/LEAD_DISCOVERY_SPEC.md`

**Decision/finding:** Re-checked `ai/LEAD_DISCOVERY_SPEC.md` directly (not just `ai/HANDOVER.md`'s account) per the prior entry's instruction to grep for `jobTitle` before assuming. The correction had **not** been applied yet — Section 6 still showed the old flat, wrong field list (`id, linkedinUrl, email, firstName, lastName, companyName, companyDomain, has, canReveal`). Applied the fix now: Section 6's "Confirmed via Lusha's V3 docs" bullet was replaced with the corrected nested `V3ContactPreview` shape (`jobTitle.title`, `company.name`/`domain`/`id`, `socialLinks.linkedin`, `has`, `canReveal`) and an explicit statement that `email` is never returned by Search Contacts. Section 3 got a new note clarifying the contact-info-present flag is never set at discovery time and only flips true during CSV/SF reconciliation (Section 4.3, step 5).

**Why this matters:** this was the second check of this blocker (see prior entry) — confirms the spec correction doesn't need re-checking a third time. `lib/lusha-client.ts` remains unbuilt and is now unblocked to proceed against the corrected field shape.

**How to apply:** `lib/lusha-client.ts` and any Search-Contacts response-parsing code can now be written directly against `ai/LEAD_DISCOVERY_SPEC.md` Section 6 as written — no further correction pending. Diff of the edit touched only Section 3's "Behavior" bullets and Section 6's Lusha-docs bullet; nothing else in the file was regressed.

---

## 2026-07-24 — Lusha API key returns 0 results on real domains; `lib/lusha-client.ts` build paused pending Lusha/IT entitlement check

**Decision/finding:** With the field-schema correction confirmed applied (previous entry), `LUSHA_API_KEY` was added to `.env.local` for the first time and the real Prospecting Search API was called directly to verify the request contract before writing mapping code (Lusha's docs at docs.lusha.com are JS-rendered and not readable via automated fetch, so this was checked live rather than assumed). The request shape used — `POST https://api.lusha.com/prospecting/contact/search` with `filters.companies.include.domains: [domain]`, `pages: { page, size≥10 }` — matches Lusha's documented schema (cross-checked via search-indexed doc content) and was accepted by the API (2xx) on every well-formed attempt, so the shape itself is **not** the problem.

**The problem:** every successful call — contact search by domain, company search by domain, company search by name "Microsoft" — returned `totalResults: 0, data: [], billing.creditsCharged: 0`, including for `microsoft.com`. A domain that large returning zero prospecting matches is not plausible; this points to the API key/contract not having prospecting-search entitlement for server-side access, which is exactly the still-open item in spec Section 6 ("confirm whether the existing Lusha contract/account supports server-side API key access... before build starts").

**Credit spend:** approximately 3 Lusha credits were consumed by this session's live test calls, despite each individual response reporting `billing.creditsCharged: 0` — this discrepancy (responses claiming 0 charged vs. ~3 actually spent per the user's own account view) is itself worth mentioning to Lusha/IT alongside the entitlement question. The 2xx (successful/billable) calls made this session, in order: (1) contact search, domain=`adaptevents.com.au`, page size 10; (2) contact search, domain=`microsoft.com`, via `companies.include.domains`; (3) company search, domain=`microsoft.com`; (4) company search, name=`"Microsoft"`. Two additional calls (page size 3; a malformed `contacts.include.seniority` filter) returned `400` and were not billed. All test calls were made via a throwaway script (`scripts/lusha-test.mjs`), deleted at the end of the session — nothing from this testing is committed.

**How to apply:** do not resume `lib/lusha-client.ts` build work until Lusha/IT confirms this key (or a replacement) has prospecting-search access enabled for server-side use. Once confirmed, the request shape and field mapping need no further investigation — build directly against the confirmed shape in this entry and the field list in Section 6 of the spec. See `ai/HANDOVER.md`'s matching session entry for the full paused-state record.

---

## 2026-07-24 — Root cause of the "0 results" block was a wrong endpoint, not an entitlement problem — Lead Discovery Phase 2 complete

**Decision/finding:** The prior entry's entitlement theory was wrong. The actual root cause: the endpoint called was `POST /prospecting/contact/search`, which is not the correct V3 endpoint — the real one is `POST /v3/contacts/prospecting`. The wrong endpoint silently accepted well-formed requests and returned `totalResults: 0` instead of erroring, which is what made a wrong-endpoint bug look like an account entitlement problem. Confirmed via Lusha's docs (`docs.lusha.com/apis/openapi/prospecting/prospectingcontacts`, fetched as raw markdown since the rendered page is JS-only) and then verified live.

**Additional shape corrections found only by calling the real endpoint** (docs alone were incomplete/inconsistent on these):
- Pagination is a nested `pagination: { page, size }` object (not flat `page`/`size`, and not `pages` as the old wrong endpoint used) — `size` has a floor of 10.
- `filters.contacts.include` and `filters.contacts.exclude` (and the `companies` equivalents) are validated as "at least one filter must be provided" if passed as `{}` — empty filter objects are rejected outright; omit the `exclude` key entirely rather than passing `{}`.
- Since spec Section 2 step 5 requires "all people found for that company" (no contact-level narrowing), the required `filters.contacts.include` was satisfied with `seniorityIds` covering the complete canonical enum (fetched live via `GET /v3/contacts/prospecting/filters/seniority` — free, no billing field on the response): `1 other, 2 intern, 3 entry, 4 senior, 5 manager, 6 director, 7 partner, 8 vice president, 9 c-suite, 10 founder`. This makes the filter a no-op rather than a real narrowing one. **Do not use `existingDataPoints` for this instead** — that would genuinely exclude real contacts missing a captured data point, which is a real narrowing, not a technical box-tick.
- The response's top-level results key is **`results`**, not `data` as Section 6's field list assumed.
- `jobTitle.seniority` in the *response* is a string label (`"director"`, `"partner"`, etc.), not the numeric `seniorityId` used in the *request* filter — these are related but not interchangeable values.
- Each result also includes a **`location`** object (`country`/`city`/`state`) not in Section 6's original field list — captured now (see below), even though not spec'd, since it's free at discovery time.

**Live confirmation:** `GET /v3/contacts/prospecting/filters` and `GET /v3/contacts/prospecting/filters/seniority` (free metadata calls, no `billing` field in either response) confirmed the endpoint and seniority enum. A real search against `adapt.com.au` (minimum page size, 10) returned `total: 128` with real ADAPT contacts — confirmed the account/key is fully functional; there was never an entitlement problem. **Total spend this session: 2/100 credits** (per the user's own Lusha dashboard), for the one 10-result real search call — consistent with "charged per result," confirming the earlier "3 credits vs. 0 charged" discrepancy was tied to the old, wrong endpoint's calls, not this one.

**Spec addition — `location` field:** `company_prospect_pool` gained a `location jsonb` column (`supabase/migrations/016_company_prospect_pool_location.sql`, re-creating the `014` RPC to also write it) to store Lusha's per-contact `location` object. This is an **addition to the pool's stored fields, not a scope deviation** — it stores zero contact/enrichment info, same as everything else in the pool, and isn't surfaced in any rep-facing UI yet (cheap to capture now, expensive to have to re-query for later).

**`lib/lusha-client.ts` built and verified end-to-end:** `discoverCompanyContacts(supabase, domain)` — checks `company_prospect_pool` for a <60-day-fresh entry first (returns cached rows, no Lusha call, per spec Section 3's staleness window); if stale/absent, calls Lusha's real Search Contacts endpoint, maps the nested response to the pool's flat schema (no `email`/phone anywhere, `has_contact_info` always `false` for `lusha`-sourced rows, per the field-schema correction two entries above), writes via the existing `writeToProspectPool`/`upsertViaRpc` path (never a plain insert), and reads back the written rows. Verified live via a temporary Next.js route handler (`app/api/lusha-test/route.ts`, deleted after use — not committed): first call hit Lusha, mapped and wrote 10 real ADAPT contacts correctly (no email/phone, `location` populated); second call against the same domain returned `source: "cache"` with no new Lusha call, confirming the staleness check works. **The real ADAPT rows written during this verification were kept in `company_prospect_pool`** (user's choice) rather than deleted — they are real, legitimate discovery-stage data for ADAPT's own domain, not synthetic test rows.

**This closes Lead Discovery Phase 2** (client + pool write-back). Phase 3 (rep-facing "Find new leads" UI, already-in-list/new split, promote/discard) is the next build, per `ai/HANDOVER.md`.

**How to apply:** any future Lusha integration work must use `POST /v3/contacts/prospecting` (never the old `/prospecting/contact/search` path), the `pagination: {page,size}` shape, and must supply all 10 seniority IDs (not `existingDataPoints`) to satisfy the required-filter validation without narrowing results. Do not re-derive any of this from docs.lusha.com scraping again — it's confirmed live and documented here.
