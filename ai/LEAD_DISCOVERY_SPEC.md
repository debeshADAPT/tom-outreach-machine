# SIGNAL — Lead Discovery: Product Spec

**Status:** Product decisions finalized. Ready for task-brief/prompt-building (route to 01).
**Author context:** Compiled from Product Decisions chat, 2026-07-23. Updated 2026-07-23: discovery provider changed from Clay to Lusha (existing Scale-tier contract, no new vendor/procurement needed).
**Depends on:** Lusha API credentials/access for the Search Contacts (V3) endpoint — confirm these are provisioned for server-side use (separate from the existing Chrome-extension usage) before build starts.

---

## 1. Why this exists

Reps currently spend 3-4 hours a day manually searching Sales Navigator to find new prospects at their target companies. This is the single largest identified time cost in the DAT workflow. Lead Discovery replaces that manual search with a SIGNAL-native feature backed by Lusha's Search Contacts API (V3) — the same data provider ADAPT already uses via the Lusha Chrome extension, now called server-side for discovery instead of manually per-contact.

**Sequencing is paused, not replaced.** This feature is being built as if the SIGNAL sequencing system will not be used for the foreseeable future. Nothing here should assume live email sending is active (it isn't — blocked on Azure App Registration, unrelated to this feature but worth remembering when reviewing any prospect state).

**Scope boundary:** SIGNAL does discovery only. It does **not** do contact enrichment (no email/phone lookup). Enrichment remains a manual step outside SIGNAL, done by the rep via the Lusha Chrome extension, same as today. SIGNAL's job ends at surfacing a name, title, company, and LinkedIn URL.

---

## 2. Rep-facing flow

1. **Admin** creates the event in Events Hub (unchanged — URLs, brief, identifiers) and assigns reps.
2. **Manager** uploads the campaign's target company list (~300 companies typical), tagged with which rep(s) own each company (2-3 reps typically split ownership across a campaign).
3. **Rep** uploads their campaign member list — the CRM-pulled list of contacts SF already considers a fit for their assigned companies. This is the rep's known-contact baseline.
4. **Rep clicks "Find new leads"** in Lead Discovery, scoped to one of their owned companies.
5. **SIGNAL returns all people found for that company** (from the Company Prospect Pool if fresh, or a live Lusha Search Contacts call if not), clearly split into two groups:
   - **Already in your list** — matched against the rep's uploaded SF contacts.
   - **New** — not currently in the rep's list.
6. Each lead shown includes: name, title, company, LinkedIn URL (clickable), and a "last found on" freshness date.
7. **Rep promotes or discards** each new lead individually:
   - **Promote** → creates a `prospects` row owned by that rep, in state **"sequence not started"** — identical initial state to a CSV-uploaded prospect. No contact info exists yet; that's expected.
   - **Discard** → soft-discard only. Never hard-deleted, always reversible.
8. If the same person has already been promoted by a different rep (different campaign/event), the lead is shown with a passive flag (e.g. "also being pursued by [rep] for [event]"). This is informational only — never a block. Any rep can still promote.
9. Rep does the LinkedIn → Lusha → Salesforce enrichment loop manually, exactly as they do today. SIGNAL plays no part in this step.
10. Later, when the rep CSV-uploads their updated SF list (as they already do today for any new contacts), reconciliation runs automatically (see Section 4).

---

## 3. Company Prospect Pool — shared backend layer

**Purpose:** avoid every rep/company/event combination triggering its own Lusha Search Contacts call. Multiple reps chasing overlapping target accounts (likely, at 6-7 reps × 100-150 companies each) should reuse discovery results instead of re-querying for the same search. (Lusha's Scale-tier rate limits — 600/min, 5,000/hour, 50,000/day — are not expected to be a constraint at this scale, but the pool still avoids redundant calls and keeps results consistent across reps.)

**Behavior:**
- Keyed by **normalized company domain** (not company name — "Caltyx" vs "Caltyx Inc" must resolve to the same key).
- Stores: name, title, company/domain, LinkedIn URL, source (`lusha` / `csv_salesforce` / `manual`), contact-info-present flag, "last found on" timestamp, and event-type fit tag(s) if applicable.
- **Note:** the contact-info-present flag is never set at discovery time — Lusha's Search Contacts response contains no email/phone data by design (Section 6). This flag starts false/absent for every discovery-sourced entry and is only flipped to true during CSV/SF reconciliation (Section 4.3, step 5), once a rep has actually enriched and re-uploaded the contact.
- **No contact enrichment data is ever stored here** — consistent with SIGNAL's discovery-only scope. Only Search Contacts (discovery) is called; Lusha's enrichment/reveal step is never called from SIGNAL, and remains a manual, rep-driven action via the Chrome extension as today.
- **Staleness window:** entries older than 60 days (finalized product decision, confirmed 2026-07-23) are treated as stale. A rep search against a stale entry triggers a fresh Lusha Search Contacts call rather than trusting cached data.
- **No merge/acquisition detection, no job-change detection.** The pool is a search cache with a shelf life, not a system of record. Drift (person left the company, companies merged) self-corrects the next time someone searches that domain — old entries simply get superseded by fresh results. This is a deliberate scope cut; do not build detection logic for this.
- "Last found on" date is always shown to the rep on every lead, so they can judge freshness themselves.
- Fit-tagging (e.g. "flagged good fit for CIO events") is **rules-based on title/seniority for v1** — not AI-scored. Do not tie this to SIGNAL's existing mocked AI scoring system; keep it a separate, honest, rules-based signal.

---

## 4. Matching & reconciliation logic

This is the most detail-sensitive part of the spec — implement carefully.

### 4.1 Matching hierarchy (used in both directions — Lead Discovery "already in your list" check, and CSV-upload reconciliation)
1. **Primary key: LinkedIn URL.** Confirmed available from SF exports, though not on all contacts.
2. **Fallback: name + company.** Used only when LinkedIn URL is absent on one or both sides. This match is inherently fuzzy (name formatting differences, e.g. "Bob Smith" vs "Robert Smith") and must never auto-merge.

### 4.2 "Already in your list" check (Lead Discovery)
When Lead Discovery returns results for a company, cross-reference each person against the rep's uploaded SF contact list using the hierarchy above, and label each result accordingly (Already in list / New).

### 4.3 Reconciliation on CSV upload
When a rep CSV-uploads their SF list (existing feature, today's entry point for new prospects):
1. For each CSV row, check for an existing `prospects` row matching via the hierarchy above.
2. **LinkedIn URL match → auto-merge.** Update the existing row in place with the new contact info from the CSV (do not create a duplicate row). Update its source tag to reflect it's now enriched/added from SF.
3. **Name+company fallback match (no LinkedIn URL available to confirm) → do NOT auto-merge.** Surface to the rep: "this may be the same person as an existing lead — confirm?" via a **side-by-side comparison UI** (both records' available fields shown together — title, company, any other distinguishing fields). Rep must explicitly confirm merge or confirm "these are different people" before either action proceeds.
4. **No match found → create new prospect row**, exactly as today's CSV upload behavior.
5. **On any successful merge** (auto or confirmed): update the corresponding Company Prospect Pool entry to mark the contact as enriched/actioned, so future searches of that company reflect this person is already fully worked, not just LinkedIn-surfaced.

### 4.4 Ambiguous match escalation
If the rep is genuinely unsure whether a fallback match is the same person, they may escalate to their manager/admin instead of guessing. Manager/admin review is a **fallback for genuine ambiguity, not the default gate** for all merges — do not require manager approval for every fallback match, only for cases the rep explicitly flags as unclear.

### 4.5 Dedup risk — explicit warning for implementation
SIGNAL's existing prospect dedup (unique index on `email, assigned_to` where `campaign_id IS NULL` — confirm this migration has actually run before relying on it) was designed around a single entry path (CSV upload). Lead Discovery introduces a second entry path (promotion) and the Lusha-fed pool write-back is a third write surface. All three (CSV insert, pool write-back, promotion write) must use a consistent upsert/`onConflict` pattern rather than a check-then-insert pattern, to avoid compounding the TOCTOU race already flagged in the June 2026 codebase audit. This should be solved once, consistently, not per-path.

---

## 5. Explicit non-goals (do not build these)

- No contact enrichment of any kind inside SIGNAL (no email/phone lookup — Lusha's enrichment/reveal step is never called from SIGNAL; enrichment stays external and manual, via the Chrome extension, exactly as today).
- No AI-scored fit tagging in v1 (rules-based only).
- No merger/acquisition detection.
- No job-change detection beyond natural staleness-driven re-search.
- No auto-merge on fuzzy (name+company) matches, ever.
- No hard delete of discarded leads — always soft/reversible.
- No assumption that sequencing, email sending, or existing AI scoring are live or reliable — all three remain paused/mocked/unimplemented respectively, and Lead Discovery does not depend on any of them.

---

## 6. Open items / dependencies to confirm before or during build

- **Lusha API credentials for server-side use.** Confirm whether the existing Lusha contract/account supports server-side API key access (distinct from the Chrome-extension login used today) — this may need to be provisioned or confirmed with Lusha/IT before build starts.
- **Confirmed via Lusha's V3 docs (2026-07-23, corrected 2026-07-23):** Search Contacts returns a `V3ContactPreview` object shaped as follows — this is a **non-PII preview only**, per Lusha's own docs ('no emails or phone numbers'):
  - `id`, `firstName`, `lastName` — flat
  - `jobTitle.title`, `jobTitle.departments`, `jobTitle.seniority` — nested
  - `company.name`, `company.domain`, `company.id` — nested
  - `socialLinks.linkedin` — LinkedIn URL, **nested, not a flat `linkedinUrl` field**
  - `has` — array of strings indicating which fields are populated on this result
  - `canReveal` — array of `{field: 'emails'|'phones', credits: number}` indicating what's unlockable via a separate, paid Enrich call
  - **`email` is not returned by Search Contacts at all.** It is only available via Lusha's Enrich endpoint, which SIGNAL must never call server-side per the discovery-only scope decision (Section 5). Field-mapping code must not assume an email or 'has email' boolean is available at discovery time.
  - Only Search Contacts (discovery) should be called from SIGNAL — do not call Lusha's enrichment/reveal endpoints from the backend, per the discovery-only scope decision.
- **Rate limits confirmed sufficient:** Scale-tier plan supports 600 requests/minute, 5,000/hour, 50,000/day — not expected to constrain usage at 6-7 reps × ~300 companies per campaign.
- **Staleness window duration — finalized at 60 days** (confirmed via product decision, 2026-07-23). No longer an open item.
- **Prospect dedup migration status** — confirm the existing unique index migration has actually run in production before layering more write paths on top of it (per Section 4.5).

---

## 7. Decisions log (for `/ai/DECISIONS.md`)

- SIGNAL's build priority is reordered: Lead Discovery is the primary near-term feature. Sequencing work is paused (not cancelled), independent of any third-party tool decision.
- Discovery provider is **Lusha (Search Contacts API, V3)**, not Clay. This uses ADAPT's existing Scale-tier Lusha contract — no new vendor or procurement required. Only the Search Contacts (discovery) endpoint is called from SIGNAL; enrichment/reveal is never called server-side.
- Lead Discovery is discovery-only — no contact enrichment inside SIGNAL, ever, by design.
- Company Prospect Pool is a shared, domain-keyed, staleness-windowed search cache — not a live-synced system of record. No drift-detection logic (mergers, job changes) will be built.
- Staleness window is finalized at 60 days (confirmed 2026-07-23).
- Promotion writes a `prospects` row in "sequence not started" state — identical to CSV-upload behavior, no new status introduced.
- Cross-rep pursuit of the same person is a passive UI flag, never a block.
- Matching hierarchy for both "already in list" checks and CSV reconciliation: LinkedIn URL primary (natively returned by Lusha's Search Contacts response), name+company fallback.
- LinkedIn URL matches auto-merge; name+company matches require explicit rep confirmation via side-by-side comparison UI. No auto-merge on fuzzy matches under any circumstance.
- Manager/admin merge review exists only as an escalation path for rep-flagged ambiguity, not as a default gate.
- All prospect-table write paths (CSV insert, pool write-back, promotion) must use a consistent upsert/onConflict pattern to avoid compounding the existing dedup race condition flagged in the June 2026 audit.
- Mock-data UI disclosure (match scores, AI Insights tab, Email Logs tab) remains a parallel priority alongside this build, not superseded by it.
