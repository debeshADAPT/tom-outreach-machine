import type { SupabaseClient } from '@supabase/supabase-js'
import { upsertViaRpc, type UpsertResult } from '@/lib/upsert'

export interface ProspectPoolRow {
  company_domain: string
  full_name: string | null
  title: string | null
  company_name: string | null
  linkedin_url: string | null
  source: 'lusha' | 'csv_salesforce' | 'manual'
  has_contact_info: boolean
  event_type_fit?: string[]
}

/**
 * Writes discovery-stage rows into the shared company_prospect_pool cache via
 * an atomic upsert (014_company_prospect_pool_upsert_rpc.sql) — never a plain
 * insert. Callers (Lusha client, CSV/Salesforce import, manual entry) only
 * need to normalize their own data into this row shape; the dedup/staleness
 * mechanics live entirely in the RPC.
 */
export async function writeToProspectPool(
  supabase: SupabaseClient,
  rows: ProspectPoolRow[]
): Promise<UpsertResult> {
  return upsertViaRpc(supabase, 'upsert_company_prospect_pool', rows)
}
