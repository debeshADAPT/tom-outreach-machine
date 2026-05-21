import { createSupabaseServer } from '@/lib/supabase-server'
import type { Campaign, CampaignWithStats } from '@/lib/types'
import CampaignsClient from './components/CampaignsClient'

export default async function CampaignsPage() {
  const supabase = await createSupabaseServer()

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  const campaignList = (campaigns ?? []) as Campaign[]

  const { data: prospectRows } = await supabase
    .from('prospects')
    .select('campaign_id, status')
    .in('campaign_id', campaignList.length > 0 ? campaignList.map(c => c.id) : [''])

  const countMap = new Map<string, { total: number; sent: number }>()
  for (const row of (prospectRows ?? []) as { campaign_id: string; status: string }[]) {
    const entry = countMap.get(row.campaign_id) ?? { total: 0, sent: 0 }
    entry.total++
    if (row.status !== 'queued') entry.sent++
    countMap.set(row.campaign_id, entry)
  }

  const campaignsWithStats: CampaignWithStats[] = campaignList.map(c => ({
    ...c,
    totalProspects: countMap.get(c.id)?.total ?? 0,
    sentProspects: countMap.get(c.id)?.sent ?? 0,
  }))

  return <CampaignsClient campaigns={campaignsWithStats} />
}
