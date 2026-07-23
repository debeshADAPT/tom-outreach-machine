-- ─────────────────────────────────────────────────────────────────────────────
-- 013_prospect_upsert_rpc.sql
-- Lead Discovery Phase 1 — the actual dedup-race fix for context-only
-- prospect writes (ai/AUDIT_FINDINGS.md finding c#5).
--
-- Why an RPC and not a plain `.upsert({ onConflict: 'email,assigned_to' })`
-- call: both dedup constraints (009_prospect_dedup.sql, 012_prospect_name_dedup.sql)
-- are PARTIAL unique indexes. Postgres only lets ON CONFLICT target a partial
-- index if the INSERT statement's own ON CONFLICT clause repeats that index's
-- WHERE predicate verbatim — otherwise it errors with "no unique or exclusion
-- constraint matching the ON CONFLICT specification" (Postgres docs, 3.19.1 /
-- the ON CONFLICT index_predicate). PostgREST's upsert path (which is all
-- supabase-js's `.upsert()` can drive) has no way to supply that predicate, so
-- it cannot target a partial index at all. Doing the real
-- `INSERT ... ON CONFLICT (...) WHERE ... DO UPDATE ...` server-side, inside a
-- SECURITY INVOKER function, is the only way to get an atomic upsert here —
-- and SECURITY INVOKER keeps existing RLS policies (005_rep_scoping.sql) in
-- force exactly as if the caller had run a plain INSERT/UPDATE themselves.
--
-- This function is the first of what should become a small family of
-- per-table upsert RPCs (one per write path: this one for the CSV path now;
-- a pool write-back RPC and a promotion RPC in later phases) — see
-- lib/upsert.ts for the shared TypeScript calling convention every one of
-- them should use.
--
-- Run manually in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_context_prospects(p_rows jsonb)
RETURNS TABLE (id uuid, inserted boolean)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  r             jsonb;
  v_id          uuid;
  v_inserted    boolean;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    IF (r->>'email') IS NOT NULL THEN
      INSERT INTO public.prospects (assigned_to, full_name, title, company, email, linkedin_url, campaign_id)
      VALUES (
        (r->>'assigned_to')::uuid,
        r->>'full_name', r->>'title', r->>'company', r->>'email', r->>'linkedin_url',
        NULL
      )
      ON CONFLICT (email, assigned_to) WHERE email IS NOT NULL AND campaign_id IS NULL
      DO UPDATE SET
        full_name    = COALESCE(EXCLUDED.full_name, public.prospects.full_name),
        title        = COALESCE(EXCLUDED.title, public.prospects.title),
        company      = COALESCE(EXCLUDED.company, public.prospects.company),
        linkedin_url = COALESCE(EXCLUDED.linkedin_url, public.prospects.linkedin_url)
      RETURNING public.prospects.id, (public.prospects.xmax = 0) INTO v_id, v_inserted;

    ELSIF (r->>'full_name') IS NOT NULL THEN
      INSERT INTO public.prospects (assigned_to, full_name, title, company, email, linkedin_url, campaign_id)
      VALUES (
        (r->>'assigned_to')::uuid,
        r->>'full_name', r->>'title', r->>'company', NULL, r->>'linkedin_url',
        NULL
      )
      ON CONFLICT (full_name, assigned_to) WHERE full_name IS NOT NULL AND email IS NULL AND campaign_id IS NULL
      DO UPDATE SET
        title        = COALESCE(EXCLUDED.title, public.prospects.title),
        company      = COALESCE(EXCLUDED.company, public.prospects.company),
        linkedin_url = COALESCE(EXCLUDED.linkedin_url, public.prospects.linkedin_url)
      RETURNING public.prospects.id, (public.prospects.xmax = 0) INTO v_id, v_inserted;

    ELSE
      -- No email, no full_name — nothing to dedup on (matches prior
      -- application-level behaviour: such rows were always inserted).
      INSERT INTO public.prospects (assigned_to, full_name, title, company, email, linkedin_url, campaign_id)
      VALUES (
        (r->>'assigned_to')::uuid,
        r->>'full_name', r->>'title', r->>'company', r->>'email', r->>'linkedin_url',
        NULL
      )
      RETURNING public.prospects.id, true INTO v_id, v_inserted;
    END IF;

    id := v_id;
    inserted := v_inserted;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_context_prospects(jsonb) TO authenticated;
