-- ─────────────────────────────────────────────────────────────────────────────
-- 011_company_prospect_pool.sql
-- Lead Discovery Phase 1 — schema only. Adds a domain-keyed shared search
-- cache of discovered people, populated later (Phase 2) by Lusha lookups and
-- CSV/Salesforce imports. Deliberately holds NO contact info (no email/phone)
-- — only discovery-stage fields. Contact enrichment happens on promotion into
-- `prospects` (a later phase), not here.
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_prospect_pool (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_domain   text        NOT NULL CHECK (company_domain = lower(company_domain)),
  full_name        text,
  title            text,
  company_name     text,
  linkedin_url     text,
  source           text        NOT NULL CHECK (source IN ('lusha', 'csv_salesforce', 'manual')),
  has_contact_info boolean     NOT NULL DEFAULT false,
  last_found_at    timestamptz NOT NULL DEFAULT now(),
  event_type_fit   text[]      NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_prospect_pool_domain_idx
  ON public.company_prospect_pool (company_domain);

-- Dedup, mirroring the two-tier pattern already used for `prospects`
-- (009_prospect_dedup.sql): prefer LinkedIn URL as the stable per-person key
-- within a domain; fall back to name when no LinkedIn URL was found.
CREATE UNIQUE INDEX IF NOT EXISTS company_prospect_pool_domain_linkedin_dedup
  ON public.company_prospect_pool (company_domain, linkedin_url)
  WHERE linkedin_url IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS company_prospect_pool_domain_name_dedup
  ON public.company_prospect_pool (company_domain, full_name)
  WHERE linkedin_url IS NULL AND full_name IS NOT NULL;

-- Reuse the existing updated_at trigger function (defined in 005_rep_scoping.sql).
CREATE TRIGGER company_prospect_pool_updated_at
  BEFORE UPDATE ON public.company_prospect_pool
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.company_prospect_pool ENABLE ROW LEVEL SECURITY;

-- Shared cache: any authenticated rep can read and contribute to it.
CREATE POLICY "Authenticated users can read the prospect pool"
  ON public.company_prospect_pool FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can write to the prospect pool"
  ON public.company_prospect_pool FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update the prospect pool"
  ON public.company_prospect_pool FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Deletion is admin-only — the pool is a shared cache, not owned by any one rep.
CREATE POLICY "Only admins can delete from the prospect pool"
  ON public.company_prospect_pool FOR DELETE TO authenticated
  USING (public.is_admin());
