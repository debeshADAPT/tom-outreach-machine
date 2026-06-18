-- ─────────────────────────────────────────────────────────────────────────────
-- 005_rep_scoping.sql
-- Adds: display_name on profiles, assigned_to on prospects,
--       campaign_assignments, rep_campaign_settings, updated prospect RLS.
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 0. Reusable admin helper ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- ─── 1. profiles — add display_name ──────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Backfill from auth.users metadata for everyone who already has a profile.
UPDATE public.profiles p
SET display_name = COALESCE(
  u.raw_user_meta_data->>'full_name',
  u.raw_user_meta_data->>'name',
  split_part(u.email, '@', 1)
)
FROM auth.users u
WHERE u.id = p.id AND p.display_name IS NULL;

-- Replace the trigger so future signups capture display_name too.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name)
  VALUES (
    NEW.id,
    'staff',
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;
  RETURN NEW;
END;
$$;

-- Widen the profiles SELECT policy so rep avatars and the AssignReps modal
-- can read other users' display names (profiles only hold id/role/display_name).
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- ─── 2. prospects — add assigned_to ──────────────────────────────────────────
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Backfill: each existing prospect goes to the campaign's original owner.
UPDATE public.prospects pr
SET assigned_to = c.user_id
FROM public.campaigns c
WHERE c.id = pr.campaign_id AND pr.assigned_to IS NULL;

-- ─── 3. campaign_assignments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_assignments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID        NOT NULL REFERENCES public.campaigns(id)  ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, user_id)
);

ALTER TABLE public.campaign_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assignments"
  ON public.campaign_assignments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can assign reps"
  ON public.campaign_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can unassign reps"
  ON public.campaign_assignments FOR DELETE TO authenticated
  USING (public.is_admin());

-- Seed: give existing campaign owners an assignment row for their own campaigns.
INSERT INTO public.campaign_assignments (campaign_id, user_id)
SELECT id, user_id FROM public.campaigns
ON CONFLICT (campaign_id, user_id) DO NOTHING;

-- ─── 4. rep_campaign_settings ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rep_campaign_settings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  sequence_delays  JSONB,
  email_templates  JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, user_id)
);

ALTER TABLE public.rep_campaign_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own rep settings"
  ON public.rep_campaign_settings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can insert own rep settings"
  ON public.rep_campaign_settings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own rep settings"
  ON public.rep_campaign_settings FOR UPDATE TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at on every write.
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER rep_campaign_settings_updated_at
  BEFORE UPDATE ON public.rep_campaign_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── 5. prospects RLS — replace blanket 004 policies ─────────────────────────
DROP POLICY IF EXISTS "All authenticated users can view prospects"  ON public.prospects;
DROP POLICY IF EXISTS "Only admins can insert prospects"            ON public.prospects;
DROP POLICY IF EXISTS "Only admins can update prospects"            ON public.prospects;
DROP POLICY IF EXISTS "Only admins can delete prospects"            ON public.prospects;

-- SELECT: admin sees all; staff see only prospects in campaigns assigned to them.
CREATE POLICY "Users can view prospects in assigned campaigns"
  ON public.prospects FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.campaign_assignments ca
      WHERE ca.campaign_id = prospects.campaign_id
        AND ca.user_id = auth.uid()
    )
  );

-- INSERT: any rep assigned to the campaign; assigned_to must equal caller.
CREATE POLICY "Assigned reps can insert own prospects"
  ON public.prospects FOR INSERT TO authenticated
  WITH CHECK (
    assigned_to = auth.uid()
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.campaign_assignments ca
        WHERE ca.campaign_id = prospects.campaign_id
          AND ca.user_id = auth.uid()
      )
    )
  );

-- UPDATE: prospect owner or admin; cannot reassign to someone else.
CREATE POLICY "Owners and admins can update prospects"
  ON public.prospects FOR UPDATE TO authenticated
  USING  (assigned_to = auth.uid() OR public.is_admin())
  WITH CHECK (assigned_to = auth.uid() OR public.is_admin());

-- DELETE: prospect owner or admin.
CREATE POLICY "Owners and admins can delete prospects"
  ON public.prospects FOR DELETE TO authenticated
  USING (assigned_to = auth.uid() OR public.is_admin());
