-- ─────────────────────────────────────────────────────────────────────────────
-- 010_event_theme.sql
-- Adds a user-entered theme/tagline column to the events table.
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS theme text;
