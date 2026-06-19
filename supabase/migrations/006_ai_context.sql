-- ─────────────────────────────────────────────────────────────────────────────
-- 006_ai_context.sql
-- Adds: intelligence fields on prospects, prospect_contexts table.
-- Also makes campaign_id nullable on prospects so AI Context Creator can
-- hold context-only prospects that aren't yet attached to a campaign.
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. prospects — make campaign_id nullable ────────────────────────────────
-- Context-only prospects (created via AI Context Creator) have no campaign yet.
ALTER TABLE public.prospects
  ALTER COLUMN campaign_id DROP NOT NULL;

-- ─── 2. prospects — add intelligence fields ──────────────────────────────────
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS intelligence            jsonb,
  ADD COLUMN IF NOT EXISTS intelligence_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS intelligence_status     text
    CHECK (intelligence_status IN ('pending', 'complete', 'failed'));

-- ─── 3. prospects RLS — extend to cover null-campaign prospects ──────────────
-- Existing policies from 005 don't match rows where campaign_id IS NULL
-- because the EXISTS subquery on campaign_assignments returns false.
-- We replace the SELECT and INSERT policies to add the null-campaign branch.

DROP POLICY IF EXISTS "Users can view prospects in assigned campaigns" ON public.prospects;

CREATE POLICY "Users can view prospects in assigned campaigns"
  ON public.prospects FOR SELECT TO authenticated
  USING (
    public.is_admin()
    -- campaign-linked prospects: user must be assigned to that campaign
    OR EXISTS (
      SELECT 1 FROM public.campaign_assignments ca
      WHERE ca.campaign_id = prospects.campaign_id
        AND ca.user_id = auth.uid()
    )
    -- context-only prospects (campaign_id IS NULL): only the owner can see them
    OR (campaign_id IS NULL AND assigned_to = auth.uid())
  );

DROP POLICY IF EXISTS "Assigned reps can insert own prospects" ON public.prospects;

CREATE POLICY "Assigned reps can insert own prospects"
  ON public.prospects FOR INSERT TO authenticated
  WITH CHECK (
    assigned_to = auth.uid()
    AND (
      public.is_admin()
      -- context-only (no campaign) — always allowed if assigned_to = caller
      OR campaign_id IS NULL
      -- campaign-linked — caller must be assigned to that campaign
      OR EXISTS (
        SELECT 1 FROM public.campaign_assignments ca
        WHERE ca.campaign_id = prospects.campaign_id
          AND ca.user_id = auth.uid()
      )
    )
  );

-- UPDATE and DELETE policies from 005 already use (assigned_to = auth.uid() OR is_admin())
-- and don't reference campaign_id, so they cover null-campaign prospects as-is.

-- ─── 4. prospect_contexts table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prospect_contexts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id   uuid        NOT NULL REFERENCES public.prospects(id)  ON DELETE CASCADE,
  campaign_id   uuid                 REFERENCES public.campaigns(id)  ON DELETE SET NULL,
  generated_by  uuid        NOT NULL REFERENCES auth.users(id),
  context_lines text        NOT NULL,
  event_name    text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prospect_contexts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all context rows.
DROP POLICY IF EXISTS "Authenticated users can select prospect_contexts" ON public.prospect_contexts;
CREATE POLICY "Authenticated users can select prospect_contexts"
  ON public.prospect_contexts FOR SELECT TO authenticated
  USING (true);

-- Any authenticated user can insert, but generated_by must equal the caller.
DROP POLICY IF EXISTS "Authenticated users can insert own prospect_contexts" ON public.prospect_contexts;
CREATE POLICY "Authenticated users can insert own prospect_contexts"
  ON public.prospect_contexts FOR INSERT TO authenticated
  WITH CHECK (generated_by = auth.uid());

-- Owner or admin can delete.
DROP POLICY IF EXISTS "Owner or admin can delete prospect_contexts" ON public.prospect_contexts;
CREATE POLICY "Owner or admin can delete prospect_contexts"
  ON public.prospect_contexts FOR DELETE TO authenticated
  USING (generated_by = auth.uid() OR public.is_admin());

-- ─── 5. Manual step after running this file ──────────────────────────────────
-- Enable Realtime on prospect_contexts in the Supabase Dashboard:
--   Table Editor → prospect_contexts → Enable Realtime
-- (Cannot be done via SQL.)
