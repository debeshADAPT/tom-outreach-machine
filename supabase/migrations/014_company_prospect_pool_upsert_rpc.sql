-- ─────────────────────────────────────────────────────────────────────────────
-- 014_company_prospect_pool_upsert_rpc.sql
-- Lead Discovery Phase 2 — pool write-back half of "Lusha client + pool
-- write-back". The Lusha HTTP client itself is not part of this migration
-- (blocked on a corrected field mapping in ai/LEAD_DISCOVERY_SPEC.md as of
-- 2026-07-23) — this RPC is deliberately Lusha-agnostic: it takes already
-- normalized rows matching company_prospect_pool's own columns, so whichever
-- client (Lusha now, csv_salesforce/manual later) calls it doesn't change.
--
-- Same shape and rationale as 013_prospect_upsert_rpc.sql: both dedup
-- constraints here (company_prospect_pool_domain_linkedin_dedup,
-- company_prospect_pool_domain_name_dedup, from 011_company_prospect_pool.sql)
-- are PARTIAL unique indexes, so a plain supabase-js `.upsert()` cannot target
-- them — see 013's header comment for the full explanation. SECURITY INVOKER
-- keeps this subject to company_prospect_pool's own RLS (011) exactly as if
-- the caller had run a plain INSERT/UPDATE themselves.
--
-- last_found_at is refreshed to now() on every successful write (insert or
-- update) — this is the field the 60-day staleness check (spec Section 3)
-- reads from.
--
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

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
        (company_domain, full_name, title, company_name, linkedin_url, source, has_contact_info, last_found_at, event_type_fit)
      VALUES (
        r->>'company_domain', r->>'full_name', r->>'title', r->>'company_name', r->>'linkedin_url',
        r->>'source', COALESCE((r->>'has_contact_info')::boolean, false), now(), v_event_fit
      )
      ON CONFLICT (company_domain, linkedin_url) WHERE linkedin_url IS NOT NULL
      DO UPDATE SET
        full_name        = COALESCE(EXCLUDED.full_name, public.company_prospect_pool.full_name),
        title            = COALESCE(EXCLUDED.title, public.company_prospect_pool.title),
        company_name     = COALESCE(EXCLUDED.company_name, public.company_prospect_pool.company_name),
        source           = EXCLUDED.source,
        has_contact_info = EXCLUDED.has_contact_info,
        last_found_at    = now(),
        event_type_fit   = EXCLUDED.event_type_fit
      RETURNING public.company_prospect_pool.id, (public.company_prospect_pool.xmax = 0) INTO v_id, v_inserted;

    ELSIF (r->>'full_name') IS NOT NULL THEN
      INSERT INTO public.company_prospect_pool
        (company_domain, full_name, title, company_name, linkedin_url, source, has_contact_info, last_found_at, event_type_fit)
      VALUES (
        r->>'company_domain', r->>'full_name', r->>'title', r->>'company_name', NULL,
        r->>'source', COALESCE((r->>'has_contact_info')::boolean, false), now(), v_event_fit
      )
      ON CONFLICT (company_domain, full_name) WHERE linkedin_url IS NULL AND full_name IS NOT NULL
      DO UPDATE SET
        title            = COALESCE(EXCLUDED.title, public.company_prospect_pool.title),
        company_name     = COALESCE(EXCLUDED.company_name, public.company_prospect_pool.company_name),
        source           = EXCLUDED.source,
        has_contact_info = EXCLUDED.has_contact_info,
        last_found_at    = now(),
        event_type_fit   = EXCLUDED.event_type_fit
      RETURNING public.company_prospect_pool.id, (public.company_prospect_pool.xmax = 0) INTO v_id, v_inserted;

    ELSE
      -- No LinkedIn URL, no full_name — nothing to dedup on; insert unconditionally.
      INSERT INTO public.company_prospect_pool
        (company_domain, full_name, title, company_name, linkedin_url, source, has_contact_info, last_found_at, event_type_fit)
      VALUES (
        r->>'company_domain', r->>'full_name', r->>'title', r->>'company_name', r->>'linkedin_url',
        r->>'source', COALESCE((r->>'has_contact_info')::boolean, false), now(), v_event_fit
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
