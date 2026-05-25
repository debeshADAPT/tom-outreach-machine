'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { refresh } from 'next/cache'

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
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('prospects')
    .insert(
      rows.map(r => ({
        campaign_id: campaignId,
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

export async function startProspectSequence(prospectId: string): Promise<void> {
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

export async function toggleProspectPaused(prospectId: string, paused: boolean): Promise<void> {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('prospects')
    .update({ paused })
    .eq('id', prospectId)
  if (error) throw error
  refresh()
}

export async function moveProspectToStep(prospectId: string, step: string): Promise<void> {
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
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('prospects')
    .update({ sequence_step: step })
    .in('id', prospectIds)
  if (error) throw error
  refresh()
}

export async function bulkPause(prospectIds: string[]): Promise<void> {
  if (prospectIds.length === 0) return
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
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('prospects')
    .update({ custom_delays: { ...(currentCustomDelays ?? {}), [gapKey]: value } })
    .eq('id', prospectId)
  if (error) throw error
  refresh()
}

export async function saveCampaignTemplate(
  campaignId: string,
  stepKey: string,
  email: { subject: string; body: string }
): Promise<void> {
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
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('campaigns')
    .update({ sequence_delays: delays })
    .eq('id', campaignId)
  if (error) throw error
  refresh()
}
