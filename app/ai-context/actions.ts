'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/require-admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProspectIntelligence {
  career_summary: string
  current_responsibilities: string
  recent_activity: string
  company_context: string
  public_presence: string
  potential_pain_points: string
  notable_achievements: string
  confidence_score: number
}

export interface ProspectContext {
  id: string
  prospect_id: string
  campaign_id: string | null
  event_id: string | null
  generated_by: string
  context_lines: string
  event_name: string
  created_at: string
  profiles?: { display_name: string | null }
}

export interface AiContextProspect {
  id: string
  full_name: string | null
  title: string | null
  company: string | null
  email: string | null
  linkedin_url?: string | null
  assigned_to: string | null
  intelligence: ProspectIntelligence | null
  intelligence_status: 'pending' | 'complete' | 'failed' | null
  intelligence_updated_at: string | null
  created_at: string
}

// ─── Phase 1: Prospect Intelligence ──────────────────────────────────────────

export async function runProspectIntelligence(
  prospectId: string
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireAuth()
  const supabase = await createSupabaseServer()

  // Load the prospect (RLS ensures caller owns it or is admin)
  const { data: prospect, error: fetchError } = await supabase
    .from('prospects')
    .select('id, full_name, title, company, email, linkedin_url')
    .eq('id', prospectId)
    .single()

  if (fetchError || !prospect) return { ok: false, error: 'Prospect not found or access denied' }

  // Mark as pending before the API call so the UI shows a spinner immediately
  await supabase
    .from('prospects')
    .update({ intelligence_status: 'pending' })
    .eq('id', prospectId)

  try {
    const linkedinLine = (prospect as { linkedin_url?: string | null }).linkedin_url
      ? `LinkedIn Profile: ${(prospect as { linkedin_url?: string | null }).linkedin_url}\nSearch this URL first — treat it as the primary identifier and ground truth for this person.\n`
      : ''

    const userMessage = `Research this specific individual and return structured intelligence as raw JSON only.
No preamble, no markdown fences, just the JSON object.

${linkedinLine}Name: ${prospect.full_name ?? 'Unknown'}
Job Title: ${prospect.title ?? 'Unknown'}
Company: ${prospect.company ?? 'Unknown'}
${prospect.email ? `Email: ${prospect.email}` : ''}

Use all identifiers above (LinkedIn URL if provided, name, company, job title) together to confidently identify the correct individual. Common names require careful disambiguation — always confirm the company and role match.

IMPORTANT: If you cannot confidently identify this specific individual, say so clearly in each field rather than describing multiple people with the same name or making assumptions about who they are.

Return this exact JSON structure with no extra keys:
{
  "career_summary": "...",
  "current_responsibilities": "...",
  "recent_activity": "...",
  "company_context": "...",
  "public_presence": "...",
  "potential_pain_points": "...",
  "notable_achievements": "...",
  "confidence_score": 5
}

confidence_score must be an integer 1–5: 5 = uniquely identified with high certainty; 3 = reasonably confident but some ambiguity; 1 = could not confidently identify this specific individual.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' } as unknown as NonNullable<Parameters<typeof anthropic.messages.create>[0]['tools']>[number]],
      messages: [{ role: 'user', content: userMessage }],
    })

    // Extract the text content from the response (may follow tool_use blocks)
    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    const raw = textBlock.text.trim()
    // Strip any accidental markdown fences
    const jsonStr = raw.startsWith('```') ? raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim() : raw
    const intelligence: ProspectIntelligence = JSON.parse(jsonStr)

    await supabase
      .from('prospects')
      .update({
        intelligence,
        intelligence_status: 'complete',
        intelligence_updated_at: new Date().toISOString(),
      })
      .eq('id', prospectId)

    return { ok: true }
  } catch (err) {
    // Do not overwrite existing intelligence on failure
    await supabase
      .from('prospects')
      .update({ intelligence_status: 'failed' })
      .eq('id', prospectId)

    return { ok: false, error: err instanceof Error ? err.message : 'Research failed' }
  }
}

// ─── Phase 2: Context Generation ─────────────────────────────────────────────

export async function generateContext(
  prospectId: string,
  eventId: string
): Promise<{ ok: boolean; context?: ProspectContext; error?: string }> {
  const userId = await requireAuth()
  const supabase = await createSupabaseServer()

  // Load prospect intelligence
  const { data: prospect, error: pError } = await supabase
    .from('prospects')
    .select('id, full_name, title, company, intelligence, intelligence_status')
    .eq('id', prospectId)
    .single()

  if (pError || !prospect) return { ok: false, error: 'Prospect not found or access denied' }
  if (prospect.intelligence_status !== 'complete' || !prospect.intelligence) {
    return { ok: false, error: 'Run prospect research first' }
  }

  // Load event brief
  const { data: event, error: eError } = await supabase
    .from('events')
    .select('id, sf_identifier, brief')
    .eq('id', eventId)
    .single()

  if (eError || !event) return { ok: false, error: 'Event not found' }
  if (!event.brief) return { ok: false, error: 'Event has no brief — sync the brief first' }

  try {
    const userMessage = `You are helping a delegate acquisition rep personalise their outreach.

Using only the intelligence provided about this prospect, and the event brief below, write 1-2 sentences explaining specifically why ${prospect.full_name ?? 'this person'} (${prospect.title ?? 'executive'} at ${prospect.company ?? 'their company'}) should attend ${event.sf_identifier}.

Be specific — reference actual details from both their background AND the event content. No generic statements. No preamble. Just the 1-2 sentences.

Prospect Intelligence:
${JSON.stringify(prospect.intelligence, null, 2)}

Event Brief:
${JSON.stringify(event.brief, null, 2)}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude')

    const contextLines = textBlock.text.trim()

    const { data: inserted, error: insertError } = await supabase
      .from('prospect_contexts')
      .insert({
        prospect_id:   prospectId,
        event_id:      eventId,
        campaign_id:   null,
        generated_by:  userId,
        context_lines: contextLines,
        event_name:    event.sf_identifier,
      })
      .select()
      .single()

    if (insertError || !inserted) return { ok: false, error: 'Failed to save context' }

    return { ok: true, context: inserted as ProspectContext }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Generation failed' }
  }
}

// ─── Bulk: Phase 1 ───────────────────────────────────────────────────────────

export async function bulkRunIntelligence(
  prospectIds: string[]
): Promise<{ total: number; succeeded: number; failed: number }> {
  await requireAuth()
  let succeeded = 0
  let failed = 0

  for (const id of prospectIds) {
    const result = await runProspectIntelligence(id)
    if (result.ok) succeeded++
    else failed++
  }

  return { total: prospectIds.length, succeeded, failed }
}

// ─── Bulk: Phase 2 ───────────────────────────────────────────────────────────

export async function bulkGenerateContext(
  prospectIds: string[],
  eventId: string
): Promise<{ total: number; succeeded: number; failed: number }> {
  await requireAuth()
  let succeeded = 0
  let failed = 0

  for (const id of prospectIds) {
    const result = await generateContext(id, eventId)
    if (result.ok) succeeded++
    else failed++
  }

  return { total: prospectIds.length, succeeded, failed }
}

// ─── Context History ──────────────────────────────────────────────────────────

export async function getProspectContextHistory(
  prospectId: string
): Promise<ProspectContext[]> {
  await requireAuth()
  const supabase = await createSupabaseServer()

  const { data } = await supabase
    .from('prospect_contexts')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false })

  if (!data || data.length === 0) return []

  // Two-step join: generated_by → auth.users (not accessible to PostgREST) → profiles
  const userIds = [...new Set(data.map(c => c.generated_by as string))]
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds)

  const profilesMap = Object.fromEntries(
    (profileRows ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name ?? null])
  )

  return data.map(c => ({
    ...c,
    profiles: { display_name: profilesMap[c.generated_by as string] ?? null },
  })) as ProspectContext[]
}

// ─── Delete Context ───────────────────────────────────────────────────────────

export async function deleteContext(
  contextId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth()
  const supabase = await createSupabaseServer()

  // RLS enforces owner-or-admin; a policy violation surfaces as an error
  const { error } = await supabase
    .from('prospect_contexts')
    .delete()
    .eq('id', contextId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─── Prospect CRUD for AI Context Creator ────────────────────────────────────

export async function insertAiContextProspects(
  rows: Array<{
    full_name: string | null
    title: string | null
    company: string | null
    email: string | null
    linkedin_url?: string | null
  }>
): Promise<{ inserted: number; skipped: number; error?: string }> {
  const userId = await requireAuth()
  const supabase = await createSupabaseServer()

  // Deduplicate by email: check which rows with a non-null email already exist
  const emailRows = rows.filter(r => r.email)
  let existingEmails = new Set<string>()

  if (emailRows.length > 0) {
    const { data: existing } = await supabase
      .from('prospects')
      .select('email')
      .in('email', emailRows.map(r => r.email!))
      .eq('assigned_to', userId)
      .is('campaign_id', null)

    existingEmails = new Set((existing ?? []).map(p => p.email as string))
  }

  const rowsToInsert = rows.filter(r => !r.email || !existingEmails.has(r.email))
  const skipped = rows.length - rowsToInsert.length

  if (rowsToInsert.length === 0) return { inserted: 0, skipped }

  const { data, error } = await supabase
    .from('prospects')
    .insert(
      rowsToInsert.map(r => ({
        // campaign_id intentionally omitted (nullable — context-only prospect)
        assigned_to: userId,
        full_name: r.full_name || null,
        title: r.title || null,
        company: r.company || null,
        email: r.email || null,
        linkedin_url: r.linkedin_url || null,
      }))
    )
    .select('id')

  if (error) return { inserted: 0, skipped, error: error.message }
  return { inserted: (data ?? []).length, skipped }
}

export async function getAiContextProspects(): Promise<AiContextProspect[]> {
  const userId = await requireAuth()
  const supabase = await createSupabaseServer()

  const { data } = await supabase
    .from('prospects')
    .select('id, full_name, title, company, email, linkedin_url, assigned_to, intelligence, intelligence_status, intelligence_updated_at, created_at')
    .is('campaign_id', null)
    .eq('assigned_to', userId)
    .order('created_at', { ascending: false })

  return (data ?? []) as AiContextProspect[]
}

export async function getLiveCampaigns() {
  await requireAuth()
  const supabase = await createSupabaseServer()

  const { data } = await supabase
    .from('campaigns')
    .select('id, name, theme, status')
    .in('status', ['active', 'draft'])
    .order('created_at', { ascending: false })

  return (data ?? []) as { id: string; name: string; theme: string | null; status: string }[]
}
