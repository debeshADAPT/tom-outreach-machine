-- ─────────────────────────────────────────────────────────────────────────────
-- 016_company_prospect_pool_location.sql
-- Lead Discovery Phase 2 — Lusha's real Search Contacts (v3/contacts/prospecting)
-- response includes a per-contact `location` object (country/city/state) that
-- was not in ai/LEAD_DISCOVERY_SPEC.md Section 6's field list. Confirmed live
-- against api.lusha.com on 2026-07-24 (see ai/DECISIONS.md). Capturing it now
-- since it's free at discovery time and expensive to re-query later, even
-- though no rep-facing UI surfaces it yet. This is a spec addition, not a
-- deviation — company_prospect_pool remains discovery-only, no contact info.
--
-- Run manually in Supabase Dashboard → SQL Editor, after 014 and 015.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.company_prospect_pool
  ADD COLUMN IF NOT EXISTS location jsonb;

-- Re-create 014's upsert RPC to also write `location` on every insert/update
-- branch. Same three-way dedup shape as 014 (linkedin_url match / full_name
-- fallback match / no-dedup insert) — only the columns list changes.
CREATE OR REPLACE FUNCTION public.upsert_company_prospect_pool(p_rows jsonb)
RETURNS TABLE (id uuid, inserted boolean)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  r             jsonb;
  v_id          uuid;
  v_inserted    boolean;
  v_event_fit   text[];
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_event_fit := COALESCE(
      (SELECT array_agg(value) FROM jsonb_array_elements_text(COALESCE(r->'event_type_fit', '[]'::jsonb))),
      '{}'::text[]
    );

    IF (r->>'linkedin_url') IS NOT NULL THEN
      INSERT INTO public.company_prospect_pool
        (company_domain, full_name, title, company_name, linkedin_url, source, has_contact_info, last_found_at, event_type_fit, location)
      VALUES (
        r->>'company_domain', r->>'full_name', r->>'title', r->>'company_name', r->>'linkedin_url',
        r->>'source', COALESCE((r->>'has_contact_info')::boolean, false), now(), v_event_fit, r->'location'
      )
      ON CONFLICT (company_domain, linkedin_url) WHERE linkedin_url IS NOT NULL
      DO UPDATE SET
        full_name        = COALESCE(EXCLUDED.full_name, public.company_prospect_pool.full_name),
        title            = COALESCE(EXCLUDED.title, public.company_prospect_pool.title),
        company_name     = COALESCE(EXCLUDED.company_name, public.company_prospect_pool.company_name),
        source           = EXCLUDED.source,
        has_contact_info = EXCLUDED.has_contact_info,
        last_found_at    = now(),
        event_type_fit   = EXCLUDED.event_type_fit,
        location         = COALESCE(EXCLUDED.location, public.company_prospect_pool.location)
      RETURNING public.company_prospect_pool.id, (public.company_prospect_pool.xmax = 0) INTO v_id, v_inserted;

    ELSIF (r->>'full_name') IS NOT NULL THEN
      INSERT INTO public.company_prospect_pool
        (company_domain, full_name, title, company_name, linkedin_url, source, has_contact_info, last_found_at, event_type_fit, location)
      VALUES (
        r->>'company_domain', r->>'full_name', r->>'title', r->>'company_name', NULL,
        r->>'source', COALESCE((r->>'has_contact_info')::boolean, false), now(), v_event_fit, r->'location'
      )
      ON CONFLICT (company_domain, full_name) WHERE linkedin_url IS NULL AND full_name IS NOT NULL
      DO UPDATE SET
        title            = COALESCE(EXCLUDED.title, public.company_prospect_pool.title),
        company_name     = COALESCE(EXCLUDED.company_name, public.company_prospect_pool.company_name),
        source           = EXCLUDED.source,
        has_contact_info = EXCLUDED.has_contact_info,
        last_found_at    = now(),
        event_type_fit   = EXCLUDED.event_type_fit,
        location         = COALESCE(EXCLUDED.location, public.company_prospect_pool.location)
      RETURNING public.company_prospect_pool.id, (public.company_prospect_pool.xmax = 0) INTO v_id, v_inserted;

    ELSE
      -- No LinkedIn URL, no full_name — nothing to dedup on; insert unconditionally.
      INSERT INTO public.company_prospect_pool
        (company_domain, full_name, title, company_name, linkedin_url, source, has_contact_info, last_found_at, event_type_fit, location)
      VALUES (
        r->>'company_domain', r->>'full_name', r->>'title', r->>'company_name', r->>'linkedin_url',
        r->>'source', COALESCE((r->>'has_contact_info')::boolean, false), now(), v_event_fit, r->'location'
      )
      RETURNING public.company_prospect_pool.id, true INTO v_id, v_inserted;
    END IF;

    id := v_id;
    inserted := v_inserted;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_company_prospect_pool(jsonb) TO authenticated;
