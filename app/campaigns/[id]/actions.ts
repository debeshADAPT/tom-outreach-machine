'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { requireAdmin, requireAuth } from '@/lib/require-admin'
import { refresh } from 'next/cache'

// ─── Prospect reads ───────────────────────────────────────────────────────────

export async function checkDuplicates(
  campaignId: string,
  emails: string[]
): Promise<string[]> {
  if (emails.length === 0) return []
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('prospects')
    .select('email')
    .eq('campaign_id', campaignId)
    .in('email', emails)
  return ((data ?? []) as { email: string }[]).map(p => p.email).filter(Boolean)
}

// ─── Prospect writes (owner or admin — RLS enforces) ─────────────────────────

export async function insertProspects(
  campaignId: string,
  rows: Array<{
    full_name: string | null
    company: string | null
    industry: string | null
    email: string | null
    title: string | null
    annual_revenue: string | null
    org_size: string | null
  }>
): Promise<{ inserted: number }> {
  const userId = await requireAuth()
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('prospects')
    .insert(
      rows.map(r => ({
        campaign_id: campaignId,
        assigned_to: userId,
        full_name: r.full_name || null,
        company: r.company || null,
        industry: r.industry || null,
        email: r.email || null,
        title: r.title || null,
        annual_revenue: r.annual_revenue || null,
        org_size: r.org_size || null,
        sequence_step: 'not_started',
        status: 'queued',
      }))
    )
    .select('id')
  if (error) throw error
  refresh()
  return { inserted: data?.length ?? 0 }
}

export async function deleteProspect(prospectId: string): Promise<void> {
  await requireAuth()
  const supabase = await createSupabaseServer()
  // RLS enforces: only the assigned_to rep or an admin can delete
  const { error } = await supabase
    .from('prospects')
    .delete()
    .eq('id', prospectId)
  if (error) throw error
  refresh()
}

export async function toggleProspectPaused(prospectId: string, paused: boolean): Promise<void> {
  await requireAuth()
  const supabase = await createSupabaseServer()
  // RLS enforces: only the assigned_to rep or an admin can update
  const { error } = await supabase
    .from('prospects')
    .update({ paused })
    .eq('id', prospectId)
  if (error) throw error
  refresh()
}

export async function moveProspectToStep(prospectId: string, step: string): Promise<void> {
  await requireAuth()
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('prospects')
    .update({ sequence_step: step })
    .eq('id', prospectId)
  if (error) throw error
  refresh()
}

export async function bulkMoveToStep(prospectIds: string[], step: string): Promise<void> {
  if (prospectIds.length === 0) return
  await requireAuth()
  const supabase = await createSupabaseServer()
  // RLS silently ignores rows not owned by this user (or not admin)
  const { error } = await supabase
    .from('prospects')
    .update({ sequence_step: step })
    .in('id', prospectIds)
  if (error) throw error
  refresh()
}

export async function bulkPause(prospectIds: string[]): Promise<void> {
  if (prospectIds.length === 0) return
  await requireAuth()
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('prospects')
    .update({ paused: true })
    .in('id', prospectIds)
  if (error) throw error
  refresh()
}

export async function saveCustomEmail(
  prospectId: string,
  stepKey: string,
  email: { subject: string; body: string }
): Promise<void> {
  await requireAuth()
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('prospects')
    .select('custom_emails')
    .eq('id', prospectId)
    .single()
  const existing = (data?.custom_emails as Record<string, { subject: string; body: string }> | null) ?? {}
  const { error } = await supabase
    .from('prospects')
    .update({ custom_emails: { ...existing, [stepKey]: email } })
    .eq('id', prospectId)
  if (error) throw error
  refresh()
}

export async function saveProspectCustomDelay(
  prospectId: string,
  gapKey: string,
  value: number,
  currentCustomDelays: Record<string, number> | null
): Promise<void> {
  await requireAuth()
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('prospects')
    .update({ custom_delays: { ...(currentCustomDelays ?? {}), [gapKey]: value } })
    .eq('id', prospectId)
  if (error) throw error
  refresh()
}

// ─── Sequence orphan actions (admin-only, no UI yet) ─────────────────────────

export async function startProspectSequence(prospectId: string): Promise<void> {
  await requireAdmin()
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('prospects')
    .update({ sequence_step: 'invite_1', status: 'queued' })
    .eq('id', prospectId)
    .eq('sequence_step', 'not_started')
  if (error) throw error
  refresh()
}

export async function bulkStartSequences(prospectIds: string[]): Promise<{ started: number }> {
  if (prospectIds.length === 0) return { started: 0 }
  await requireAdmin()
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('prospects')
    .update({ sequence_step: 'invite_1', status: 'queued' })
    .in('id', prospectIds)
    .eq('sequence_step', 'not_started')
    .select('id')
  if (error) throw error
  refresh()
  return { started: data?.length ?? 0 }
}

// ─── Campaign writes (admin-only) ─────────────────────────────────────────────

export async function updateCampaign(
  campaignId: string,
  updates: {
    name: string
    theme: string | null
    event_date: string | null
    location: string | null
    event_brief: string | null
  }
): Promise<void> {
  await requireAdmin()
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('campaigns')
    .update({
      name: updates.name,
      theme: updates.theme || null,
      event_date: updates.event_date || null,
      location: updates.location || null,
      event_brief: updates.event_brief || null,
    })
    .eq('id', campaignId)
  if (error) throw error
  refresh()
}

export async function saveCampaignTemplate(
  campaignId: string,
  stepKey: string,
  email: { subject: string; body: string }
): Promise<void> {
  await requireAdmin()
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('campaigns')
    .select('email_templates')
    .eq('id', campaignId)
    .single()
  const existing = (data?.email_templates as Record<string, { subject: string; body: string }> | null) ?? {}
  const { error } = await supabase
    .from('campaigns')
    .update({ email_templates: { ...existing, [stepKey]: email } })
    .eq('id', campaignId)
  if (error) throw error
  refresh()
}

export async function saveSequenceDelays(
  campaignId: string,
  delays: Record<string, number>
): Promise<void> {
  await requireAdmin()
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('campaigns')
    .update({ sequence_delays: delays })
    .eq('id', campaignId)
  if (error) throw error
  refresh()
}

// ─── Rep settings (own row in rep_campaign_settings) ─────────────────────────

export async function saveRepTemplate(
  campaignId: string,
  stepKey: string,
  email: { subject: string; body: string }
): Promise<void> {
  const userId = await requireAuth()
  const supabase = await createSupabaseServer()
  const { data: existing } = await supabase
    .from('rep_campaign_settings')
    .select('email_templates')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .single()
  const templates = (existing?.email_templates as Record<string, { subject: string; body: string }> | null) ?? {}
  const { error } = await supabase
    .from('rep_campaign_settings')
    .upsert(
      { campaign_id: campaignId, user_id: userId, email_templates: { ...templates, [stepKey]: email } },
      { onConflict: 'campaign_id,user_id' }
    )
  if (error) throw error
  refresh()
}

export async function saveRepDelays(
  campaignId: string,
  delays: Record<string, number>
): Promise<void> {
  const userId = await requireAuth()
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('rep_campaign_settings')
    .upsert(
      { campaign_id: campaignId, user_id: userId, sequence_delays: delays },
      { onConflict: 'campaign_id,user_id' }
    )
  if (error) throw error
  refresh()
}

// ─── Rep assignment (admin-only) ──────────────────────────────────────────────

export async function assignRep(campaignId: string, userId: string): Promise<void> {
  await requireAdmin()
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('campaign_assignments')
    .insert({ campaign_id: campaignId, user_id: userId })
  if (error) throw error
  refresh()
}

export async function unassignRep(campaignId: string, userId: string): Promise<void> {
  await requireAdmin()
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('campaign_assignments')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
  if (error) throw error
  refresh()
}
