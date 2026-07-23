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
