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

  const [{ data: campaign }, { data: prospects }] = await Promise.all([
    supabase.from('campaigns').select('*').eq('id', id).single(),
    supabase.from('prospects').select('*').eq('campaign_id', id).order('created_at', { ascending: true }),
  ])

  if (!campaign) notFound()

  const c = campaign as Campaign
  const p = (prospects ?? []) as Prospect[]
  const badge = campaignStatusBadge(c.status)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F6F3' }}>
      <div style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E5E5', padding: '24px 32px 0 32px' }}>
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
        {tab === 'overview' && <OverviewTab campaign={c} prospects={p} />}
        {tab === 'prospects' && <ProspectsTab campaignId={id} prospects={p} />}
        {tab === 'sequence' && <SequenceTab />}
        {tab === 'settings' && <SettingsTab campaign={c} />}
      </div>
    </div>
  )
}
