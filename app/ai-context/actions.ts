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
}

export interface ProspectContext {
  id: string
  prospect_id: string
  campaign_id: string | null
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
    .select('id, full_name, title, company, email')
    .eq('id', prospectId)
    .single()

  if (fetchError || !prospect) return { ok: false, error: 'Prospect not found or access denied' }

  // Mark as pending before the API call so the UI shows a spinner immediately
  await supabase
    .from('prospects')
    .update({ intelligence_status: 'pending' })
    .eq('id', prospectId)

  try {
    const userMessage = `Research this person and return structured intelligence as raw JSON only.
No preamble, no markdown fences, just the JSON object.

Person: ${prospect.full_name ?? 'Unknown'}
Title: ${prospect.title ?? 'Unknown'}
Company: ${prospect.company ?? 'Unknown'}
${prospect.email ? `Email: ${prospect.email}` : ''}

Return this exact JSON structure with no extra keys:
{
  "career_summary": "...",
  "current_responsibilities": "...",
  "recent_activity": "...",
  "company_context": "...",
  "public_presence": "...",
  "potential_pain_points": "...",
  "notable_achievements": "..."
}`

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
  campaignId: string
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

  // Load campaign
  const { data: campaign, error: cError } = await supabase
    .from('campaigns')
    .select('id, name, theme')
    .eq('id', campaignId)
    .single()

  if (cError || !campaign) return { ok: false, error: 'Campaign not found' }

  try {
    const userMessage = `You are helping a delegate acquisition rep personalise their outreach.
Using only the intelligence provided, write 1-2 sentences explaining specifically why ${prospect.full_name ?? 'this person'} (${prospect.title ?? 'executive'} at ${prospect.company ?? 'their company'}) should attend ${campaign.name}${campaign.theme ? ` (${campaign.theme})` : ''}.

Be specific — reference actual details from their background.
No generic statements. No preamble. Just the 1-2 sentences.

Intelligence:
${JSON.stringify(prospect.intelligence, null, 2)}`

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
        prospect_id: prospectId,
        campaign_id: campaignId,
        generated_by: userId,
        context_lines: contextLines,
        event_name: campaign.name,
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
  campaignId: string
): Promise<{ total: number; succeeded: number; failed: number }> {
  await requireAuth()
  let succeeded = 0
  let failed = 0

  for (const id of prospectIds) {
    const result = await generateContext(id, campaignId)
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
    .select('*, profiles(display_name)')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false })

  return (data ?? []) as ProspectContext[]
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
  }>
): Promise<{ inserted: number; error?: string }> {
  const userId = await requireAuth()
  const supabase = await createSupabaseServer()

  const { data, error } = await supabase
    .from('prospects')
    .insert(
      rows.map(r => ({
        // campaign_id intentionally omitted (nullable — context-only prospect)
        assigned_to: userId,
        full_name: r.full_name || null,
        title: r.title || null,
        company: r.company || null,
        email: r.email || null,
      }))
    )
    .select('id')

  if (error) return { inserted: 0, error: error.message }
  return { inserted: (data ?? []).length }
}

export async function getAiContextProspects(): Promise<AiContextProspect[]> {
  const userId = await requireAuth()
  const supabase = await createSupabaseServer()

  const { data } = await supabase
    .from('prospects')
    .select('id, full_name, title, company, email, assigned_to, intelligence, intelligence_status, intelligence_updated_at, created_at')
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
