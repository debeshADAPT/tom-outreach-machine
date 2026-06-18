import { Suspense } from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import type { Campaign, Prospect, RepCampaignSettings } from '@/lib/types'
import { campaignStatusBadge } from '@/lib/utils'
import TabNav from './components/TabNav'
import OverviewTab from './components/OverviewTab'
import AIInsightsTab from './components/AIInsightsTab'
import ProspectsTab from './components/ProspectsTab'
import SequenceTab from './components/SequenceTab'
import EmailLogsTab from './components/EmailLogsTab'
import SettingsTab from './components/SettingsTab'
import CampaignHeaderActions from './components/CampaignHeaderActions'
import { RealtimeRefresher } from '@/components/RealtimeRefresher'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function CampaignDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { tab = 'dashboard' } = await searchParams

  const supabase = await createSupabaseServer()
  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', id).single()

  if (!campaign) notFound()

  // Update last_visited_at in the background (fire-and-forget)
  supabase.from('campaigns').update({ last_visited_at: new Date().toISOString() }).eq('id', id)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'

  // Staff must be assigned to this campaign
  if (!isAdmin) {
    const { data: assignment } = await supabase
      .from('campaign_assignments')
      .select('id')
      .eq('campaign_id', id)
      .eq('user_id', user.id)
      .single()
    if (!assignment) redirect('/campaigns?error=not_assigned')
  }

  const c = campaign as Campaign
  const badge = campaignStatusBadge(c.status)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F6F3' }}>
      <RealtimeRefresher tables={['campaigns', 'prospects']} />
      <div style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E5E5', padding: '24px 32px 0 32px' }}>
        <Link
          href="/campaigns"
          className="hover:text-[#6B7280] transition-colors"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            fontSize: '13px', color: '#9CA3AF', textDecoration: 'none',
            marginBottom: '8px',
          }}
        >
          ← Campaigns
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0D0D0D', margin: 0 }}>
              {c.name}
            </h1>
            <span style={{
              padding: '3px 10px', borderRadius: '20px', fontSize: '12px',
              fontWeight: '500', backgroundColor: badge.bg, color: badge.color,
            }}>
              {badge.label}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CampaignHeaderActions campaign={c} isAdmin={isAdmin} />
          </div>
        </div>
        <TabNav campaignId={id} activeTab={tab} />
      </div>

      <div style={{ padding: '28px 32px' }}>
        <Suspense fallback={
          <div className="relative min-h-64 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-[#E5E5E5] border-t-[#E7534F] animate-spin" />
          </div>
        }>
          <TabContent campaignId={id} tab={tab} campaign={c} isAdmin={isAdmin} currentUserId={user.id} />
        </Suspense>
      </div>
    </div>
  )
}

async function TabContent({
  campaignId, tab, campaign, isAdmin, currentUserId,
}: {
  campaignId: string
  tab: string
  campaign: Campaign
  isAdmin: boolean
  currentUserId: string
}) {
  const supabase = await createSupabaseServer()

  const [{ data: prospectsData }, { data: repSettingsData }, { data: profilesData }] = await Promise.all([
    supabase
      .from('prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true }),
    supabase
      .from('rep_campaign_settings')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('user_id', currentUserId)
      .single(),
    // Admin needs display names to show which rep owns each prospect
    isAdmin
      ? supabase.from('profiles').select('id, display_name')
      : Promise.resolve({ data: [] }),
  ])

  const allProspects = (prospectsData ?? []) as Prospect[]
  const repSettings = repSettingsData as RepCampaignSettings | null

  // SequenceTab and EmailLogsTab: staff see only their own prospects; admins see all
  const visibleProspects = isAdmin
    ? allProspects
    : allProspects.filter(p => p.assigned_to === currentUserId)

  const profilesMap: Record<string, string> = Object.fromEntries(
    (profilesData ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name ?? '?'])
  )

  const repName = profilesMap[currentUserId]
    ?? allProspects[0]?.assigned_to === currentUserId ? (profilesMap[currentUserId] ?? 'Your Name') : 'Your Name'

  const repNameFallback = (() => {
    const match = (profilesData ?? []).find((p: { id: string }) => p.id === currentUserId)
    return (match as { display_name?: string | null } | undefined)?.display_name ?? 'Your Name'
  })()

  return (
    <>
      {tab === 'dashboard'   && <OverviewTab campaign={campaign} prospects={allProspects} />}
      {tab === 'ai-insights' && <AIInsightsTab campaign={campaign} prospects={allProspects} />}
      {tab === 'prospects'   && <ProspectsTab campaign={campaign} prospects={allProspects} />}
      {tab === 'sequence'    && (
        <SequenceTab
          prospects={visibleProspects}
          campaign={campaign}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          repDelays={repSettings?.sequence_delays ?? null}
          profilesMap={isAdmin ? profilesMap : undefined}
        />
      )}
      {tab === 'email-logs'  && (
        <EmailLogsTab
          campaign={campaign}
          prospects={visibleProspects}
          repName={repNameFallback}
        />
      )}
      {tab === 'settings'    && (
        <SettingsTab
          campaign={campaign}
          isAdmin={isAdmin}
          repSettings={repSettings}
        />
      )}
    </>
  )
}
