-- ─────────────────────────────────────────────────────────────────────────────
-- 008_events_hub.sql
-- Adds: events table, event_changelog table, event_id FK on campaigns,
--       event_id FK on campaign_assignments, event_id FK on prospect_contexts.
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. events ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sf_identifier    text        NOT NULL UNIQUE,
  event_type       text        NOT NULL CHECK (event_type IN ('EDGE', 'Roundtable')),
  date             date        NOT NULL,
  location         text        NOT NULL,
  url_main         text,
  url_speakers     text,   -- EDGE only
  url_agenda       text,   -- EDGE only
  brief            jsonb,
  brief_status     text    CHECK (brief_status IN ('pending', 'complete', 'failed')),
  brief_updated_at timestamptz,
  created_by       uuid        REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read events
DROP POLICY IF EXISTS "Authenticated users can select events" ON public.events;
CREATE POLICY "Authenticated users can select events"
  ON public.events FOR SELECT TO authenticated
  USING (true);

-- Only admins can create events
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
CREATE POLICY "Admins can insert events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- Only admins can update events
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
CREATE POLICY "Admins can update events"
  ON public.events FOR UPDATE TO authenticated
  USING (public.is_admin());

-- Only admins can delete events
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
CREATE POLICY "Admins can delete events"
  ON public.events FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─── 2. event_changelog ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_changelog (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        REFERENCES public.events(id) ON DELETE CASCADE,
  changed_by  uuid        REFERENCES auth.users(id),
  changed_at  timestamptz NOT NULL DEFAULT now(),
  change_type text,   -- 'created' | 'brief_synced' | 'rep_assigned' | 'rep_unassigned'
  detail      jsonb   -- stores previous brief snapshot on brief_synced
);

ALTER TABLE public.event_changelog ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read changelog
DROP POLICY IF EXISTS "Authenticated users can select event_changelog" ON public.event_changelog;
CREATE POLICY "Authenticated users can select event_changelog"
  ON public.event_changelog FOR SELECT TO authenticated
  USING (true);

-- Any authenticated user can insert changelog entries (system-generated on actions)
DROP POLICY IF EXISTS "Authenticated users can insert event_changelog" ON public.event_changelog;
CREATE POLICY "Authenticated users can insert event_changelog"
  ON public.event_changelog FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid());

-- ─── 3. campaigns — add event_id ─────────────────────────────────────────────
-- Nullable so existing orphaned campaigns are unaffected.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id);

-- ─── 4. campaign_assignments — add event_id ───────────────────────────────────
-- Tracks which event level assignment created a rep's campaign slot.

ALTER TABLE public.campaign_assignments
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id);

-- ─── 5. prospect_contexts — add event_id ─────────────────────────────────────
-- Additive: existing campaign_id column stays intact for backward compat.

ALTER TABLE public.prospect_contexts
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id);
