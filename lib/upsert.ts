import type { SupabaseClient } from '@supabase/supabase-js'

export interface UpsertRowResult {
  id: string
  inserted: boolean // true = new row created, false = an existing row was matched and updated
}

export interface UpsertResult {
  results: UpsertRowResult[]
  error?: string
}

/**
 * Calls a Postgres RPC that performs a real `INSERT ... ON CONFLICT ... DO UPDATE`
 * against a partial unique index. Every dedup-sensitive write path (CSV import,
 * pool write-back, promotion) should go through an RPC like this rather than
 * supabase-js's `.upsert()` — PostgREST's upsert has no way to supply the WHERE
 * predicate a partial index's ON CONFLICT target requires, so it cannot target
 * one at all (see 013_prospect_upsert_rpc.sql for the full explanation).
 *
 * Each write path defines its own RPC (matching its own table's constraint) and
 * calls it through this same wrapper for a consistent shape and error handling.
 */
export async function upsertViaRpc(
  supabase: SupabaseClient,
  rpcName: string,
  rows: Record<string, unknown>[]
): Promise<UpsertResult> {
  if (rows.length === 0) return { results: [] }

  const { data, error } = await supabase.rpc(rpcName, { p_rows: rows })
  if (error) return { results: [], error: error.message }
  return { results: (data ?? []) as UpsertRowResult[] }
}
