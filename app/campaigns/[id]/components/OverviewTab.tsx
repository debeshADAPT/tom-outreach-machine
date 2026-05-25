'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Campaign, Prospect } from '@/lib/types'

interface Props {
  campaign: Campaign
  prospects: Prospect[]
}

function countFrequencies(values: (string | null | undefined)[]): { label: string; count: number }[] {
  const map = new Map<string, number>()
  for (const v of values) {
    const s = v?.trim()
    if (s) map.set(s, (map.get(s) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

function StatCard({ label, value, pct }: { label: string; value: number; pct?: number }) {
  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
      borderRadius: '8px', padding: '20px 24px',
    }}>
      <p style={{ fontSize: '36px', fontWeight: '700', color: '#0D0D0D', margin: '0 0 4px' }}>{value}</p>
      {pct !== undefined && (
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 6px' }}>{pct}%</p>
      )}
      <p style={{ fontSize: '13px', color: '#6B7280', fontWeight: '500', margin: 0 }}>{label}</p>
    </div>
  )
}

function BreakdownSection({
  title, items, nullMessage,
}: {
  title: string
  items: { label: string; count: number }[]
  nullMessage: string
}) {
  const maxCount = items[0]?.count ?? 1
  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
      borderRadius: '10px', padding: '20px',
    }}>
      <p style={{
        fontSize: '11px', fontWeight: '600', color: '#9CA3AF',
        textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 16px',
      }}>
        {title}
      </p>
      {items.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: 1.5 }}>{nullMessage}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map(({ label, count }) => (
            <div key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '13px', color: '#0D0D0D',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%',
                }}>
                  {label}
                </span>
                <span style={{ fontSize: '12px', color: '#9CA3AF', flexShrink: 0, marginLeft: '8px' }}>
                  {count}
                </span>
              </div>
              <div style={{ height: '6px', backgroundColor: '#F3F3F1', borderRadius: '3px' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round((count / maxCount) * 100)}%`,
                  backgroundColor: '#E7534F', borderRadius: '3px',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Urgency card ─────────────────────────────────────────────────────────────

interface UrgencyCardData {
  label: string
  description: string
  count: number
  href: string
  borderColor: string
  bgColor: string
  badgeBg: string
}

function UrgencyCard({ card }: { card: UrgencyCardData }) {
  const [hovered, setHovered] = useState(false)
  const active = card.count > 0

  const baseStyle: React.CSSProperties = {
    display: 'block', padding: '16px 20px', borderRadius: '10px',
    border: '1px solid #E5E5E5', borderLeft: `4px solid ${active ? card.borderColor : '#E5E5E5'}`,
    backgroundColor: active ? (hovered ? card.bgColor : card.bgColor) : '#FFFFFF',
    textDecoration: 'none', opacity: active ? 1 : 0.4,
    filter: hovered && active ? 'brightness(0.97)' : 'none',
    transition: 'filter 0.1s',
    cursor: active ? 'pointer' : 'default',
  }

  const inner = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#0D0D0D' }}>{card.label}</div>
        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{card.description}</div>
      </div>
      <div style={{
        minWidth: '36px', height: '36px', borderRadius: '50%',
        backgroundColor: active ? card.badgeBg : '#D1D5DB',
        color: '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '15px', fontWeight: '700', flexShrink: 0,
      }}>
        {card.count}
      </div>
    </div>
  )

  if (active) {
    return (
      <Link
        href={card.href}
        style={baseStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {inner}
      </Link>
    )
  }

  return <div style={baseStyle}>{inner}</div>
}

// ─── Sequence funnel ──────────────────────────────────────────────────────────

const FUNNEL_STEPS = [
  { key: 'not_started', label: 'Not Started' },
  { key: 'invite_1', label: 'Initial Invite' },
  { key: 'followup_1', label: 'Follow-up 1' },
  { key: 'followup_2', label: 'Follow-up 2' },
  { key: 'followup_3', label: 'Follow-up 3' },
  { key: 'final', label: 'Final' },
]

function SequenceFunnel({ prospects }: { prospects: Prospect[] }) {
  const total = prospects.length
  if (total === 0) return null

  const funnelData = FUNNEL_STEPS.map(({ key, label }) => {
    const group = prospects.filter(p => p.sequence_step === key)
    return {
      key, label,
      count: group.length,
      pct: Math.round((group.length / total) * 100),
      replied: group.filter(p => p.status === 'replied').length,
      bounced: group.filter(p => p.status === 'bounced' || p.status === 'unsubscribed').length,
    }
  }).filter(d => d.count > 0)

  if (funnelData.length === 0) return null

  const maxCount = Math.max(...funnelData.map(d => d.count))

  return (
    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: '10px', padding: '20px 24px' }}>
      <p style={{
        fontSize: '11px', fontWeight: '600', color: '#9CA3AF',
        textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 16px',
      }}>
        Sequence Funnel
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {funnelData.map(row => (
          <div key={row.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: '#6B7280', width: '108px', flexShrink: 0 }}>
                {row.label}
              </span>
              <div style={{ flex: 1, height: '8px', backgroundColor: '#F3F3F1', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round((row.count / maxCount) * 100)}%`,
                  backgroundColor: '#E7534F', borderRadius: '4px',
                }} />
              </div>
              <span style={{ fontSize: '13px', color: '#0D0D0D', fontWeight: '600', width: '32px', textAlign: 'right', flexShrink: 0 }}>
                {row.count}
              </span>
              <span style={{ fontSize: '12px', color: '#9CA3AF', width: '34px', flexShrink: 0 }}>
                {row.pct}%
              </span>
            </div>
            {(row.replied > 0 || row.bounced > 0) && (
              <div style={{ display: 'flex', gap: '12px', paddingLeft: '120px', marginTop: '3px' }}>
                {row.replied > 0 && (
                  <span style={{ fontSize: '11px', color: '#16A34A' }}>✓ {row.replied} replied</span>
                )}
                {row.bounced > 0 && (
                  <span style={{ fontSize: '11px', color: '#DC2626' }}>✗ {row.bounced} bounced</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OverviewTab({ campaign, prospects }: Props) {
  if (prospects.length === 0) {
    return (
      <div style={{
        backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
        borderRadius: '12px', padding: '60px 24px', textAlign: 'center',
      }}>
        <p style={{ fontSize: '16px', fontWeight: '600', color: '#0D0D0D', marginBottom: '8px' }}>
          No prospects yet
        </p>
        <p style={{ fontSize: '14px', color: '#6B7280' }}>
          Go to the Prospects tab to upload contacts and get started.
        </p>
      </div>
    )
  }

  const total = prospects.length
  const contacted = prospects.filter(p => p.status !== 'queued').length
  const replied = prospects.filter(p => p.status === 'replied').length
  const bounced = prospects.filter(p => p.status === 'bounced' || p.status === 'unsubscribed').length
  const contactedPct = Math.round((contacted / total) * 100)
  const repliedPct = Math.round((replied / total) * 100)

  const industryItems = countFrequencies(prospects.map(p => p.industry))
  const orgSizeItems = countFrequencies(prospects.map(p => p.org_size))
  const revenueItems = countFrequencies(prospects.map(p => p.annual_revenue))

  const orgSizeNullPct = prospects.filter(p => !p.org_size?.trim()).length / total
  const revenueNullPct = prospects.filter(p => !p.annual_revenue?.trim()).length / total

  const emailsReady = prospects.filter(p => p.sequence_step !== 'not_started' && p.status === 'queued').length
  const sequenceNotStarted = prospects.filter(p => p.sequence_step === 'not_started').length
  const needsReview = bounced

  const urgencyCards: UrgencyCardData[] = [
    {
      label: 'Replies needing action',
      description: 'Prospects who have replied to your outreach',
      count: replied,
      href: `/campaigns/${campaign.id}?tab=prospects`,
      borderColor: '#E7534F',
      bgColor: '#FEF2F2',
      badgeBg: '#E7534F',
    },
    {
      label: 'Emails ready to send',
      description: 'Prospects in sequence with emails queued',
      count: emailsReady,
      href: `/campaigns/${campaign.id}?tab=prospects`,
      borderColor: '#F59E0B',
      bgColor: '#FFFBEB',
      badgeBg: '#F59E0B',
    },
    {
      label: 'Sequence not started',
      description: 'Prospects not yet added to the sequence',
      count: sequenceNotStarted,
      href: `/campaigns/${campaign.id}?tab=prospects`,
      borderColor: '#3B82F6',
      bgColor: '#EFF6FF',
      badgeBg: '#3B82F6',
    },
    {
      label: 'Needs review',
      description: 'Bounced or unsubscribed prospects',
      count: needsReview,
      href: `/campaigns/${campaign.id}?tab=prospects`,
      borderColor: '#9CA3AF',
      bgColor: '#F9FAFB',
      badgeBg: '#9CA3AF',
    },
  ]

  const totalPending = urgencyCards.reduce((sum, c) => sum + c.count, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Action Required */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <p style={{
            fontSize: '11px', fontWeight: '600', color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0,
          }}>
            Action Required
          </p>
          {totalPending > 0 && (
            <span style={{
              backgroundColor: '#E7534F', color: '#FFFFFF',
              fontSize: '11px', fontWeight: '700',
              padding: '2px 7px', borderRadius: '20px',
            }}>
              {totalPending}
            </span>
          )}
        </div>

        {totalPending === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0',
            borderRadius: '10px', padding: '20px 24px',
            borderLeft: '4px solid #22C55E',
          }}>
            <span style={{ fontSize: '18px' }}>✓</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#166534' }}>
              All clear — no actions required
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {urgencyCards.map(card => (
              <UrgencyCard key={card.label} card={card} />
            ))}
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <StatCard label="Total Prospects" value={total} />
        <StatCard label="Contacted" value={contacted} pct={contactedPct} />
        <StatCard label="Replied" value={replied} pct={repliedPct} />
        <StatCard label="Bounced / Unsubscribed" value={bounced} />
      </div>

      {/* Sequence Funnel */}
      <SequenceFunnel prospects={prospects} />

      {/* Company Breakdown */}
      <div>
        <p style={{
          fontSize: '11px', fontWeight: '600', color: '#9CA3AF',
          textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 12px',
        }}>
          Company Breakdown
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <BreakdownSection
            title="Industry Mix"
            items={industryItems}
            nullMessage="No industry data in this campaign yet."
          />
          <BreakdownSection
            title="Org Size"
            items={orgSizeNullPct > 0.9 ? [] : orgSizeItems}
            nullMessage="Upload a CSV with an 'org size' column to see this breakdown."
          />
          <BreakdownSection
            title="Annual Revenue"
            items={revenueNullPct > 0.9 ? [] : revenueItems}
            nullMessage="Upload a CSV with an 'annual revenue' column to see this breakdown."
          />
        </div>
      </div>

    </div>
  )
}
