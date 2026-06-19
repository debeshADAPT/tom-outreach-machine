-- ─────────────────────────────────────────────────────────────────────────────
-- 007_linkedin_url.sql
-- Adds linkedin_url column to prospects.
-- Required by the AI Context Creator CSV import and Phase 1 research prompt.
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS linkedin_url text;
