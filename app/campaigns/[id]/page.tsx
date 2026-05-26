import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import type { Campaign, Prospect } from '@/lib/types'
import { campaignStatusBadge } from '@/lib/utils'
import TabNav from './components/TabNav'
import OverviewTab from './components/OverviewTab'
import AIInsightsTab from './components/AIInsightsTab'
import ProspectsTab from './components/ProspectsTab'
import SequenceTab from './components/SequenceTab'
import EmailLogsTab from './components/EmailLogsTab'
import SettingsTab from './components/SettingsTab'
import CampaignHeaderActions from './components/CampaignHeaderActions'

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

  const c = campaign as Campaign
  const badge = campaignStatusBadge(c.status)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F6F3' }}>
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
          ← My Campaigns
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
            <CampaignHeaderActions campaign={c} />
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
          <TabContent campaignId={id} tab={tab} campaign={c} />
        </Suspense>
      </div>
    </div>
  )
}

async function TabContent({
  campaignId, tab, campaign,
}: {
  campaignId: string; tab: string; campaign: Campaign
}) {
  const supabase = await createSupabaseServer()
  const [{ data: prospectsData }, { data: { user } }] = await Promise.all([
    supabase.from('prospects').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: true }),
    supabase.auth.getUser(),
  ])

  const p = (prospectsData ?? []) as Prospect[]
  const repName = user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? user?.email?.split('@')[0]
    ?? 'Your Name'

  return (
    <>
      {tab === 'dashboard'   && <OverviewTab campaign={campaign} prospects={p} />}
      {tab === 'ai-insights' && <AIInsightsTab campaign={campaign} prospects={p} />}
      {tab === 'prospects'   && <ProspectsTab campaign={campaign} prospects={p} />}
      {tab === 'sequence'    && <SequenceTab prospects={p} campaign={campaign} />}
      {tab === 'email-logs'  && <EmailLogsTab campaign={campaign} prospects={p} repName={repName} />}
      {tab === 'settings'    && <SettingsTab campaign={campaign} />}
    </>
  )
}
