-- ─────────────────────────────────────────────────────────────────────────────
-- 009_prospect_dedup.sql
-- Adds a partial unique index on prospects(email, assigned_to) scoped to
-- AI Context prospects (campaign_id IS NULL, email IS NOT NULL).
-- This prevents duplicate imports via the AI Context Creator.
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS prospects_email_assigned_dedup
  ON public.prospects (email, assigned_to)
  WHERE email IS NOT NULL AND campaign_id IS NULL;
