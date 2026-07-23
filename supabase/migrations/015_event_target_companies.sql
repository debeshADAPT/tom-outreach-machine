-- ─────────────────────────────────────────────────────────────────────────────
-- 015_event_target_companies.sql
-- Lead Discovery Phase 3, part 1 — manager (admin) upload of an event's
-- target company list, tagged with which rep(s) own each company.
--
-- Scoped to event_id, not campaign_id: a "campaign" in this app is
-- rep-scoped (assignRepToEvent() creates one campaigns row per rep per
-- event), so scoping this list per-campaign would mean re-uploading the
-- same list once per rep on a shared event. One list per event, split by
-- rep ownership, matches the spec's intent and how everything else
-- Lead-Discovery-adjacent (prospect_contexts.event_id) is already scoped.
--
-- company_domain normalization matches 011_company_prospect_pool.sql's
-- CHECK exactly, so the two systems key consistently once Lead Discovery
-- search reads this table (a later phase).
--
-- Note: (event_id, company_domain) below is a PLAIN unique index (no WHERE
-- clause) — unlike 009/012/011's partial indexes, a normal supabase-js
-- .upsert({ onConflict: 'event_id,company_domain' }) works fine against it.
-- The RPC-based upsert pattern in ai/DECISIONS.md is specifically for
-- partial indexes; it doesn't apply here.
--
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_target_companies (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  company_name   text        NOT NULL,
  company_domain text        NOT NULL CHECK (company_domain = lower(company_domain)),
  created_by     uuid        REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, company_domain)
);

CREATE INDEX IF NOT EXISTS event_target_companies_event_idx
  ON public.event_target_companies (event_id);

-- Many-to-many: a company can be owned by more than one rep ("rep(s)" per spec).
CREATE TABLE IF NOT EXISTS public.event_target_company_reps (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_company_id  uuid NOT NULL REFERENCES public.event_target_companies(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (target_company_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_target_company_reps_company_idx
  ON public.event_target_company_reps (target_company_id);

ALTER TABLE public.event_target_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_target_company_reps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view target companies"
  ON public.event_target_companies FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can write target companies"
  ON public.event_target_companies FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update target companies"
  ON public.event_target_companies FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete target companies"
  ON public.event_target_companies FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Authenticated users can view target company rep tags"
  ON public.event_target_company_reps FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can write target company rep tags"
  ON public.event_target_company_reps FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete target company rep tags"
  ON public.event_target_company_reps FOR DELETE TO authenticated
  USING (public.is_admin());
