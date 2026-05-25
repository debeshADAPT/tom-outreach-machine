import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import type { Campaign, Prospect } from '@/lib/types'
import { campaignStatusBadge } from '@/lib/utils'
import TabNav from './components/TabNav'
import OverviewTab from './components/OverviewTab'
import ProspectsTab from './components/ProspectsTab'
import SequenceTab from './components/SequenceTab'
import SettingsTab from './components/SettingsTab'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function CampaignDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { tab = 'overview' } = await searchParams

  const supabase = await createSupabaseServer()
  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', id).single()

  if (!campaign) notFound()

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
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
  const { data: prospects } = await supabase
    .from('prospects')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })

  const p = (prospects ?? []) as Prospect[]

  return (
    <>
      {tab === 'overview'  && <OverviewTab campaign={campaign} prospects={p} />}
      {tab === 'prospects' && <ProspectsTab campaign={campaign} prospects={p} />}
      {tab === 'sequence'  && <SequenceTab prospects={p} campaign={campaign} />}
      {tab === 'settings'  && <SettingsTab campaign={campaign} />}
    </>
  )
}
