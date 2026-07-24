import type { SupabaseClient } from '@supabase/supabase-js'
import { writeToProspectPool, type ProspectPoolRow } from '@/lib/prospect-pool'
import type { CompanyProspectPoolRow } from '@/lib/types'

const LUSHA_API_BASE = 'https://api.lusha.com'
const STALENESS_WINDOW_MS = 60 * 24 * 60 * 60 * 1000 // 60 days, ai/LEAD_DISCOVERY_SPEC.md Section 3
const PAGE_SIZE = 50 // Lusha's per-page max (confirmed 2026-07-24)

// Confirmed live against api.lusha.com 2026-07-24 (ai/DECISIONS.md). "At least
// one filter must be provided" is enforced by the API even when we only want
// company-level (domain) filtering — passing every seniority ID makes this a
// no-op rather than a real narrowing filter, per spec Section 2 step 5
// ("SIGNAL returns all people found for that company"). Do not use
// existingDataPoints for this — that would genuinely exclude real contacts.
const ALL_SENIORITY_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface LushaContactResult {
  id: string
  firstName: string | null
  lastName: string | null
  jobTitle?: { title?: string; departments?: string[]; seniority?: string }
  company: { id: string; name: string; domain: string }
  location?: { country?: string; city?: string; state?: string }
  socialLinks?: { linkedin?: string }
  has: string[]
  canReveal: { field: string; credits: number }[]
}

interface LushaSearchResponse {
  requestId: string
  pagination: { page: number; size: number; total: number }
  results: LushaContactResult[]
  billing: { creditsCharged: number; resultsReturned: number }
}

export interface DiscoverCompanyContactsResult {
  rows: CompanyProspectPoolRow[]
  source: 'cache' | 'lusha'
  totalFound: number | null
}

/**
 * Discovery for one company domain, per ai/LEAD_DISCOVERY_SPEC.md Section 2
 * step 5. Returns cached company_prospect_pool rows if a fresh (<60 day)
 * entry exists for the domain; otherwise calls Lusha's Search Contacts API
 * (v3/contacts/prospecting), maps and writes the results, then returns them.
 *
 * Never calls Lusha's Enrich/reveal endpoints — discovery-only, per spec
 * Section 5. Throws on any Lusha API or Supabase failure rather than
 * returning an empty result, so callers can't mistake a real failure for
 * "no contacts found".
 */
export async function discoverCompanyContacts(
  supabase: SupabaseClient,
  companyDomain: string,
  options?: { pageSize?: number }
): Promise<DiscoverCompanyContactsResult> {
  const domain = companyDomain.trim().toLowerCase()

  const { data: freshnessCheck, error: freshnessError } = await supabase
    .from('company_prospect_pool')
    .select('last_found_at')
    .eq('company_domain', domain)
    .order('last_found_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (freshnessError) {
    throw new Error(`Failed to check company_prospect_pool staleness: ${freshnessError.message}`)
  }

  const isFresh =
    !!freshnessCheck && Date.now() - new Date(freshnessCheck.last_found_at).getTime() < STALENESS_WINDOW_MS

  if (isFresh) {
    const { data: cachedRows, error: cachedError } = await supabase
      .from('company_prospect_pool')
      .select('*')
      .eq('company_domain', domain)

    if (cachedError) {
      throw new Error(`Failed to read cached company_prospect_pool rows: ${cachedError.message}`)
    }

    return { rows: (cachedRows ?? []) as CompanyProspectPoolRow[], source: 'cache', totalFound: null }
  }

  const searchResult = await searchLushaContacts(domain, options?.pageSize ?? PAGE_SIZE)

  const rowsToWrite: ProspectPoolRow[] = searchResult.results.map((contact) => mapLushaContact(contact, domain))

  const writeResult = await writeToProspectPool(supabase, rowsToWrite)
  if (writeResult.error) {
    throw new Error(`Failed to write Lusha results to company_prospect_pool: ${writeResult.error}`)
  }

  const { data: writtenRows, error: readBackError } = await supabase
    .from('company_prospect_pool')
    .select('*')
    .eq('company_domain', domain)

  if (readBackError) {
    throw new Error(`Failed to read back written company_prospect_pool rows: ${readBackError.message}`)
  }

  return {
    rows: (writtenRows ?? []) as CompanyProspectPoolRow[],
    source: 'lusha',
    totalFound: searchResult.pagination.total,
  }
}

async function searchLushaContacts(domain: string, pageSize: number): Promise<LushaSearchResponse> {
  const apiKey = process.env.LUSHA_API_KEY
  if (!apiKey) {
    throw new Error('LUSHA_API_KEY is not configured')
  }

  const body = {
    pagination: { page: 0, size: pageSize },
    filters: {
      contacts: { include: { seniorityIds: ALL_SENIORITY_IDS } },
      companies: { include: { domains: [domain] } },
    },
  }

  const res = await fetch(`${LUSHA_API_BASE}/v3/contacts/prospecting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', api_key: apiKey },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Lusha Search Contacts request failed (${res.status}): ${text || res.statusText}`)
  }

  return (await res.json()) as LushaSearchResponse
}

// Confirmed field shape live against api.lusha.com 2026-07-24 (ai/DECISIONS.md):
// top-level results key is `results`, not `data` as originally assumed from
// Lusha's docs. `jobTitle.seniority` is a string label ("director", "partner",
// etc.), not the numeric seniorityId used in the request filter — the two
// are not the same value and must not be conflated. `email` never appears
// anywhere in this response by design (Search Contacts is discovery-only).
function mapLushaContact(contact: LushaContactResult, domain: string): ProspectPoolRow {
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || null

  return {
    company_domain: domain,
    full_name: fullName,
    title: contact.jobTitle?.title ?? null,
    company_name: contact.company?.name ?? null,
    linkedin_url: contact.socialLinks?.linkedin ?? null,
    source: 'lusha',
    has_contact_info: false,
    location: contact.location ?? null,
  }
}
