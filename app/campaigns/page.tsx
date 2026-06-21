import { createSupabaseServer } from '@/lib/supabase-server'
import type { Campaign, CampaignWithStats } from '@/lib/types'
import CampaignsClient from './components/CampaignsClient'

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function CampaignsPage({ searchParams }: Props) {
  const { error: accessError } = await searchParams
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <CampaignsClient campaigns={[]} isAdmin={false} />

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Staff see only campaigns they're assigned to; admins see all
  let campaignQuery = supabase
    .from('campaigns')
    .select('*, prospects(count)')
    .order('event_date', { ascending: true })

  if (!isAdmin) {
    const { data: myAssignments } = await supabase
      .from('campaign_assignments')
      .select('campaign_id')
      .eq('user_id', user.id)
    const myCampaignIds = (myAssignments ?? []).map((a: { campaign_id: string }) => a.campaign_id)
    if (myCampaignIds.length === 0) {
      return <CampaignsClient campaigns={[]} isAdmin={false} accessError={accessError} />
    }
    campaignQuery = campaignQuery.in('id', myCampaignIds)
  }

  const { data: campaigns } = await campaignQuery

  const campaignList = (campaigns ?? []) as unknown as Array<Campaign & { prospects: [{ count: number }] }>
  const campaignIds = campaignList.map(c => c.id)

  // Fetch sent counts and rep assignments in parallel
  const [{ data: sentRows }, { data: allAssignmentsData }] = await Promise.all([
    campaignIds.length > 0
      ? supabase
          .from('prospects')
          .select('campaign_id')
          .in('campaign_id', campaignIds)
          .neq('status', 'queued')
      : Promise.resolve({ data: [] }),
    campaignIds.length > 0
      ? supabase
          .from('campaign_assignments')
          .select('campaign_id, user_id')
          .in('campaign_id', campaignIds)
      : Promise.resolve({ data: [] }),
  ])

  // Fetch profiles for all assigned reps
  const assignedUserIds = [...new Set((allAssignmentsData ?? []).map((a: { user_id: string }) => a.user_id))]
  const { data: profilesData } = assignedUserIds.length > 0
    ? await supabase.from('profiles').select('id, display_name').in('id', assignedUserIds)
    : { data: [] }

  const profilesMap = Object.fromEntries(
    (profilesData ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name ?? '?'])
  )

  // Build per-campaign rep lists
  const assignmentsMap = new Map<string, { userId: string; displayName: string }[]>()
  for (const a of ((allAssignmentsData ?? []) as { campaign_id: string; user_id: string }[])) {
    const reps = assignmentsMap.get(a.campaign_id) ?? []
    reps.push({ userId: a.user_id, displayName: profilesMap[a.user_id] ?? '?' })
    assignmentsMap.set(a.campaign_id, reps)
  }

  const sentMap = new Map<string, number>()
  for (const row of (sentRows ?? []) as { campaign_id: string }[]) {
    sentMap.set(row.campaign_id, (sentMap.get(row.campaign_id) ?? 0) + 1)
  }

  const campaignsWithStats: CampaignWithStats[] = campaignList.map(c => ({
    id: c.id,
    user_id: c.user_id,
    name: c.name,
    theme: c.theme,
    event_id: (c as unknown as { event_id?: string | null }).event_id ?? null,
    event_date: c.event_date,
    location: c.location,
    event_brief: c.event_brief,
    status: c.status,
    created_at: c.created_at,
    totalProspects: c.prospects?.[0]?.count ?? 0,
    sentProspects: sentMap.get(c.id) ?? 0,
    assignedReps: assignmentsMap.get(c.id) ?? [],
  }))

  return <CampaignsClient campaigns={campaignsWithStats} isAdmin={isAdmin} accessError={accessError} />
}
