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
