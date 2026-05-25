import { createSupabaseServer } from '@/lib/supabase-server'
import type { Campaign, CampaignWithStats } from '@/lib/types'
import CampaignsClient from './components/CampaignsClient'

export default async function CampaignsPage() {
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <CampaignsClient campaigns={[]} />

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*, prospects(count)')
    .eq('user_id', user.id)
    .order('event_date', { ascending: true })

  const campaignList = (campaigns ?? []) as unknown as Array<Campaign & { prospects: [{ count: number }] }>
  const campaignIds = campaignList.map(c => c.id)

  const { data: sentRows } = campaignIds.length > 0
    ? await supabase
        .from('prospects')
        .select('campaign_id')
        .in('campaign_id', campaignIds)
        .neq('status', 'queued')
    : { data: [] }

  const sentMap = new Map<string, number>()
  for (const row of (sentRows ?? []) as { campaign_id: string }[]) {
    sentMap.set(row.campaign_id, (sentMap.get(row.campaign_id) ?? 0) + 1)
  }

  const campaignsWithStats: CampaignWithStats[] = campaignList.map(c => ({
    id: c.id,
    user_id: c.user_id,
    name: c.name,
    theme: c.theme,
    event_date: c.event_date,
    location: c.location,
    event_brief: c.event_brief,
    status: c.status,
    created_at: c.created_at,
    totalProspects: c.prospects?.[0]?.count ?? 0,
    sentProspects: sentMap.get(c.id) ?? 0,
  }))

  return <CampaignsClient campaigns={campaignsWithStats} />
}
