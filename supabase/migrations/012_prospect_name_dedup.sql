-- ─────────────────────────────────────────────────────────────────────────────
-- 012_prospect_name_dedup.sql
-- Companion to 009_prospect_dedup.sql. That migration added a partial unique
-- index for the email-based dedup path on AI Context prospects, but the
-- fallback dedup path (rows with no email, deduped by full_name only) has
-- never had any DB-level constraint — it was pure application-level checking
-- in insertAiContextProspects, which is exactly the TOCTOU race flagged in
-- ai/AUDIT_FINDINGS.md (finding c#5). This closes that gap so BOTH dedup
-- paths have a real constraint an upsert can target.
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS prospects_fullname_assigned_dedup
  ON public.prospects (full_name, assigned_to)
  WHERE full_name IS NOT NULL AND email IS NULL AND campaign_id IS NULL;
