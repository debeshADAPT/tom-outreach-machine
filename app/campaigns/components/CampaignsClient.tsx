'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate, campaignStatusBadge } from '@/lib/utils'
import type { CampaignWithStats } from '@/lib/types'
import NewCampaignModal from './NewCampaignModal'
import { RealtimeRefresher } from '@/components/RealtimeRefresher'

const FILTERS = ['All', 'Active', 'Draft', 'Completed'] as const
type Filter = (typeof FILTERS)[number]

interface Props {
  campaigns: CampaignWithStats[]
  isAdmin: boolean
  accessError?: string
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

interface EventGroup {
  event_id: string
  name: string
  event_date: string | null
  campaigns: CampaignWithStats[]
  totalProspects: number
  sentProspects: number
  allReps: { userId: string; displayName: string }[]
}

type TableItem =
  | { type: 'group'; group: EventGroup }
  | { type: 'campaign'; campaign: CampaignWithStats }

function groupAndSort(campaigns: CampaignWithStats[]): TableItem[] {
  const groupMap = new Map<string, EventGroup>()
  const orphans: CampaignWithStats[] = []

  for (const c of campaigns) {
    if (c.event_id) {
      if (!groupMap.has(c.event_id)) {
        groupMap.set(c.event_id, {
          event_id: c.event_id,
          name: c.name,
          event_date: c.event_date,
          campaigns: [],
          totalProspects: 0,
          sentProspects: 0,
          allReps: [],
        })
      }
      const g = groupMap.get(c.event_id)!
      g.campaigns.push(c)
      g.totalProspects += c.totalProspects
      g.sentProspects += c.sentProspects
      for (const rep of c.assignedReps) {
        if (!g.allReps.find(r => r.userId === rep.userId)) g.allReps.push(rep)
      }
    } else {
      orphans.push(c)
    }
  }

  const items: TableItem[] = [
    ...Array.from(groupMap.values()).map(g => ({ type: 'group' as const, group: g })),
    ...orphans.map(c => ({ type: 'campaign' as const, campaign: c })),
  ]

  return items.sort((a, b) => {
    const aAllCompleted = a.type === 'group'
      ? a.group.campaigns.every(c => c.status === 'completed')
      : a.campaign.status === 'completed'
    const bAllCompleted = b.type === 'group'
      ? b.group.campaigns.every(c => c.status === 'completed')
      : b.campaign.status === 'completed'
    if (aAllCompleted !== bAllCompleted) return aAllCompleted ? 1 : -1

    const aDate = a.type === 'group' ? a.group.event_date : a.campaign.event_date
    const bDate = b.type === 'group' ? b.group.event_date : b.campaign.event_date
    if (!aDate && !bDate) return 0
    if (!aDate) return 1
    if (!bDate) return -1
    return new Date(aDate).getTime() - new Date(bDate).getTime()
  })
}

function groupStatus(group: EventGroup): CampaignWithStats['status'] {
  const statuses = group.campaigns.map(c => c.status)
  if (statuses.every(s => s === 'completed')) return 'completed'
  if (statuses.some(s => s === 'active')) return 'active'
  return 'draft'
}

function RepAvatars({ reps }: { reps: { userId: string; displayName: string }[] }) {
  if (reps.length === 0) return null
  const shown = reps.slice(0, 3)
  const overflow = reps.length - 3

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '-4px' }}>
      {shown.map((rep, i) => {
        const initials = rep.displayName
          .split(' ')
          .map(w => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
        const colors = ['#E7534F', '#4F7FE7', '#4FE7A0', '#E7C44F']
        const bg = colors[i % colors.length]
        return (
          <div
            key={rep.userId}
            title={rep.displayName}
            style={{
              width: '24px', height: '24px', borderRadius: '50%',
              backgroundColor: bg, color: '#FFFFFF',
              fontSize: '10px', fontWeight: '600',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid #FFFFFF',
              marginLeft: i > 0 ? '-6px' : 0,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
        )
      })}
      {overflow > 0 && (
        <div style={{
          width: '24px', height: '24px', borderRadius: '50%',
          backgroundColor: '#E5E5E5', color: '#6B7280',
          fontSize: '10px', fontWeight: '600',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1.5px solid #FFFFFF',
          marginLeft: '-6px', flexShrink: 0,
        }}>
          +{overflow}
        </div>
      )}
    </div>
  )
}

export default function CampaignsClient({ campaigns, isAdmin, accessError }: Props) {
  const [filter, setFilter] = useState<Filter>('All')
  const [showModal, setShowModal] = useState(false)
  const [dismissedError, setDismissedError] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  function toggleGroup(eventId: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(eventId) ? next.delete(eventId) : next.add(eventId)
      return next
    })
  }

  const filtered = campaigns.filter(c =>
    filter === 'All' || c.status === filter.toLowerCase()
  )
  const items = groupAndSort(filtered)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F6F3', padding: '32px' }}>
      <RealtimeRefresher tables={['campaigns']} />

      {/* Access error banner */}
      {accessError === 'not_assigned' && !dismissedError && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: '#FEF3C7', border: '1px solid #FCD34D',
          borderRadius: '8px', padding: '12px 16px', marginBottom: '20px',
          fontSize: '14px', color: '#92400E',
        }}>
          <span>You don&apos;t have access to that campaign. Ask an admin to assign you.</span>
          <button
            onClick={() => setDismissedError(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400E', fontSize: '16px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0D0D0D', margin: 0, lineHeight: 1.2 }}>
            Campaigns
          </h1>
          <p style={{ marginTop: '4px', fontSize: '14px', color: '#6B7280' }}>
            {campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="transition-colors"
            style={{
              padding: '10px 18px', backgroundColor: '#E7534F', color: '#FFFFFF',
              border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#D94440')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#E7534F')}
          >
            + New Campaign
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px', borderRadius: '20px', border: '1px solid',
              borderColor: filter === f ? '#E7534F' : '#E5E5E5',
              backgroundColor: filter === f ? '#E7534F' : '#FFFFFF',
              color: filter === f ? '#FFFFFF' : '#6B7280',
              fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.1s',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState onNew={() => setShowModal(true)} isFiltered={filter !== 'All'} isAdmin={isAdmin} />
      ) : (
        <CampaignsTable items={items} expandedGroups={expandedGroups} onToggleGroup={toggleGroup} />
      )}

      {showModal && <NewCampaignModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

function EmptyState({ onNew, isFiltered, isAdmin }: { onNew: () => void; isFiltered: boolean; isAdmin: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '80px 24px', backgroundColor: '#FFFFFF', borderRadius: '12px',
      border: '1px solid #E5E5E5',
    }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
      <p style={{ fontSize: '16px', fontWeight: '600', color: '#0D0D0D', marginBottom: '6px' }}>
        {isFiltered ? 'No campaigns match this filter' : 'No campaigns yet'}
      </p>
      <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px' }}>
        {isFiltered
          ? 'Try selecting a different filter above.'
          : isAdmin
          ? 'Create your first one to get started.'
          : 'You haven\'t been assigned to any campaigns yet.'}
      </p>
      {!isFiltered && isAdmin && (
        <button
          onClick={onNew}
          style={{
            padding: '10px 20px', backgroundColor: '#E7534F', color: '#FFFFFF',
            border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#D94440')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#E7534F')}
        >
          + New Campaign
        </button>
      )}
    </div>
  )
}

function ProgressCell({ sent, total }: { sent: number; total: number }) {
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0
  return (
    <td style={{ padding: '14px 16px', minWidth: '160px' }}>
      <div style={{ height: '4px', backgroundColor: '#F3F3F1', borderRadius: '2px', marginBottom: '5px' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#E7534F', borderRadius: '2px', transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: '12px', color: '#6B7280' }}>{sent} / {total} sent</span>
    </td>
  )
}

function CampaignsTable({ items, expandedGroups, onToggleGroup }: {
  items: TableItem[]
  expandedGroups: Set<string>
  onToggleGroup: (eventId: string) => void
}) {
  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E5E5', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
            {['Campaign', 'Theme', 'Event Date', 'Contacts', 'Progress', 'Reps', 'Status'].map(col => (
              <th key={col} style={{
                padding: '12px 16px', textAlign: 'left', fontSize: '11px',
                fontWeight: '600', color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const isLast = i === items.length - 1
            if (item.type === 'group') {
              const expanded = expandedGroups.has(item.group.event_id)
              return (
                <>
                  <EventGroupRow
                    key={item.group.event_id}
                    group={item.group}
                    expanded={expanded}
                    onToggle={() => onToggleGroup(item.group.event_id)}
                    isLast={isLast && !expanded}
                  />
                  {expanded && (() => {
                    const activeCampaigns = item.group.campaigns.filter(c => c.assignedReps.length > 0)
                    return activeCampaigns.map((c, ci) => (
                      <RepCampaignRow
                        key={c.id}
                        campaign={c}
                        isLast={ci === activeCampaigns.length - 1 && isLast}
                      />
                    ))
                  })()}
                </>
              )
            }
            return <CampaignRow key={item.campaign.id} campaign={item.campaign} isLast={isLast} />
          })}
        </tbody>
      </table>
    </div>
  )
}

function EventGroupRow({ group, expanded, onToggle, isLast }: {
  group: EventGroup
  expanded: boolean
  onToggle: () => void
  isLast: boolean
}) {
  const badge = campaignStatusBadge(groupStatus(group))
  const repCount = group.allReps.length

  return (
    <tr
      onClick={onToggle}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F9F8F6')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      style={{ borderBottom: isLast ? 'none' : '1px solid #E5E5E5', cursor: 'pointer' }}
    >
      <td style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg
            viewBox="0 0 20 20" fill="currentColor" width="13" height="13"
            style={{ flexShrink: 0, color: '#9CA3AF', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          <span style={{ fontWeight: '700', color: '#0D0D0D', fontSize: '14px' }}>
            {group.name}
          </span>
          <span style={{
            fontSize: '11px', fontWeight: '500', color: '#6B7280',
            backgroundColor: '#F3F4F6', padding: '1px 7px', borderRadius: '10px',
          }}>
            {repCount} {repCount === 1 ? 'rep' : 'reps'}
          </span>
        </div>
      </td>
      <td style={{ padding: '14px 16px', fontSize: '14px', color: '#6B7280' }}>—</td>
      <td style={{ padding: '14px 16px', fontSize: '14px', color: '#6B7280', whiteSpace: 'nowrap' }}>
        {formatDate(group.event_date)}
      </td>
      <td style={{ padding: '14px 16px', fontSize: '14px', color: '#0D0D0D', fontWeight: '500' }}>
        {group.totalProspects}
      </td>
      <ProgressCell sent={group.sentProspects} total={group.totalProspects} />
      <td style={{ padding: '14px 16px' }}>
        <RepAvatars reps={group.allReps} />
      </td>
      <td style={{ padding: '14px 16px' }}>
        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', backgroundColor: badge.bg, color: badge.color }}>
          {badge.label}
        </span>
      </td>
    </tr>
  )
}

function RepCampaignRow({ campaign, isLast }: { campaign: CampaignWithStats; isLast: boolean }) {
  const router = useRouter()
  const badge = campaignStatusBadge(campaign.status)
  const repName = campaign.assignedReps[0]?.displayName ?? '—'

  return (
    <tr
      onClick={() => router.push(`/campaigns/${campaign.id}`)}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F9F8F6')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      style={{ borderBottom: isLast ? 'none' : '1px solid #E5E5E5', cursor: 'pointer', backgroundColor: '#FAFAFA' }}
    >
      <td style={{ padding: '11px 16px 11px 38px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#D1D5DB', fontSize: '12px' }}>└</span>
          <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>{repName}</span>
        </div>
      </td>
      <td style={{ padding: '11px 16px', fontSize: '13px', color: '#9CA3AF' }}>—</td>
      <td style={{ padding: '11px 16px', fontSize: '13px', color: '#9CA3AF' }}>—</td>
      <td style={{ padding: '11px 16px', fontSize: '13px', color: '#0D0D0D', fontWeight: '500' }}>
        {campaign.totalProspects}
      </td>
      <ProgressCell sent={campaign.sentProspects} total={campaign.totalProspects} />
      <td style={{ padding: '11px 16px' }} />
      <td style={{ padding: '11px 16px' }}>
        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', backgroundColor: badge.bg, color: badge.color }}>
          {badge.label}
        </span>
      </td>
    </tr>
  )
}

function CampaignRow({ campaign, isLast }: { campaign: CampaignWithStats; isLast: boolean }) {
  const router = useRouter()
  const badge = campaignStatusBadge(campaign.status)

  return (
    <tr
      onClick={() => router.push(`/campaigns/${campaign.id}`)}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F9F8F6')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      style={{ borderBottom: isLast ? 'none' : '1px solid #E5E5E5', cursor: 'pointer' }}
    >
      <td style={{ padding: '14px 16px' }}>
        <span style={{ fontWeight: '600', color: '#0D0D0D', fontSize: '14px' }}>{campaign.name}</span>
      </td>
      <td style={{ padding: '14px 16px', fontSize: '14px', color: '#6B7280' }}>{campaign.theme ?? '—'}</td>
      <td style={{ padding: '14px 16px', fontSize: '14px', color: '#6B7280', whiteSpace: 'nowrap' }}>
        {formatDate(campaign.event_date)}
      </td>
      <td style={{ padding: '14px 16px', fontSize: '14px', color: '#0D0D0D', fontWeight: '500' }}>
        {campaign.totalProspects}
      </td>
      <ProgressCell sent={campaign.sentProspects} total={campaign.totalProspects} />
      <td style={{ padding: '14px 16px' }}>
        <RepAvatars reps={campaign.assignedReps} />
      </td>
      <td style={{ padding: '14px 16px' }}>
        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', backgroundColor: badge.bg, color: badge.color }}>
          {badge.label}
        </span>
      </td>
    </tr>
  )
}
