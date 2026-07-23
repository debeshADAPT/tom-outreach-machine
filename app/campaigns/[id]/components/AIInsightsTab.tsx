'use client'

import type { ReactNode } from 'react'
import type { Campaign, Prospect } from '@/lib/types'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { MockDataBanner } from '@/components/MockDataBadge'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Props {
  campaign: Campaign
  prospects: Prospect[]
}

// ─── MOCK DATA — replace with real data later ─────────────────────────────────

const TOP_MATCHES = [
  {
    initials: 'SC', bg: '#6366F1', name: 'Sarah Chen', title: 'Chief Information Officer',
    company: 'Meridian Health Group', score: 92, tier: 'High' as const,
    signals: ['Past attendee', 'Replied positively'], followUp: 1,
  },
  {
    initials: 'JO', bg: '#0EA5E9', name: 'James Okafor', title: 'VP of Information Technology',
    company: 'Pacific National Bank', score: 87, tier: 'High' as const,
    signals: ['Opened 5×', 'Clicked agenda link'], followUp: 2,
  },
  {
    initials: 'LB', bg: '#10B981', name: 'Laura Brennan', title: 'Chief Technology Officer',
    company: 'CoreLogic Systems', score: 81, tier: 'High' as const,
    signals: ['Viewed agenda', 'Replied positively'], followUp: 2,
  },
  {
    initials: 'DN', bg: '#F59E0B', name: 'David Nguyen', title: 'IT Director',
    company: 'Vantage Energy', score: 75, tier: 'High' as const,
    signals: ['Past attendee', 'Opened 3×'], followUp: 3,
  },
  {
    initials: 'RK', bg: '#EC4899', name: 'Rachel Kim', title: 'VP Engineering',
    company: 'Axiom Financial', score: 68, tier: 'Medium' as const,
    signals: ['Clicked link', 'Interested in AI strategy'], followUp: 3,
  },
  {
    initials: 'MS', bg: '#8B5CF6', name: 'Mark Sullivan', title: 'Head of Digital Transformation',
    company: 'GovConnect', score: 58, tier: 'Medium' as const,
    signals: ['Opened 2×', 'Viewed agenda'], followUp: 4,
  },
]

// prospects 72+58+34+45+27=236, replies 16+14+6+5+1=42
const INDUSTRY_PERF = [
  { industry: 'Technology',         prospects: 72, replies: 16, rate: 22.2 },
  { industry: 'Healthcare',         prospects: 58, replies: 14, rate: 24.1 },
  { industry: 'Government',         prospects: 34, replies: 6,  rate: 17.6 },
  { industry: 'Financial Services', prospects: 45, replies: 5,  rate: 11.1 },
  { industry: 'Energy',             prospects: 27, replies: 1,  rate: 3.7  },
]

// values sum: 119+89+28=236, pcts 50+38+12=100
const TIER_COVERAGE = [
  { name: 'Tier 3', value: 119, pct: 50, color: '#E7534F' },
  { name: 'Tier 2', value: 89,  pct: 38, color: '#F59E0B' },
  { name: 'Tier 1', value: 28,  pct: 12, color: '#10B981' },
]

const TOPICS = [
  { topic: 'AI & Automation Strategy',               speaker: 'Panel Session', rate: 28 },
  { topic: 'Cloud Infrastructure Modernisation',     speaker: 'Keynote',       rate: 23 },
  { topic: 'Cybersecurity & Risk Management',        speaker: 'Workshop',      rate: 19 },
  { topic: 'Data Analytics & Business Intelligence', speaker: 'Panel Session', rate: 14 },
  { topic: 'Digital Transformation Leadership',      speaker: 'Keynote',       rate: 9  },
]

const AI_INSIGHT_CARDS = [
  {
    icon: '📈', color: '#10B981', bg: '#D1FAE5',
    headline: 'Healthcare & Technology lead in reply rate',
    body: 'Healthcare prospects are converting at 24.1% and Technology at 22.2% — both well above the campaign average of 18%. Prospects in these verticals are 40% more likely to book a meeting after a follow-up. In your next send wave, prioritise these two sectors for personalised outreach.',
    action: 'Segment your next batch to focus on Healthcare and Technology prospects before branching to lower-performing verticals.',
  },
  {
    icon: '🕐', color: '#3B82F6', bg: '#DBEAFE',
    headline: 'Tuesday–Wednesday morning is your best send window',
    body: 'Emails sent Tuesday through Wednesday 9–11am AEST achieve 34% higher open rates compared to end-of-week sends. Reply rates drop by nearly half when sent on Fridays. Your last two follow-up waves were sent on Thursday afternoons.',
    action: 'Reschedule the next follow-up batch to Tuesday morning for maximum visibility.',
  },
  {
    icon: '⚠️', color: '#F59E0B', bg: '#FEF3C7',
    headline: '47 prospects are stalled at Follow-up 2',
    body: 'These contacts have received two emails with no opens, clicks, or replies. Industry benchmarks suggest a 12-day stall at this stage indicates low intent or wrong contact. Continuing to send risks damaging your sender reputation with these domains.',
    action: 'Review the 47 stalled prospects — either remove them or trigger a re-engagement email with a different subject line.',
  },
  {
    icon: '🔥', color: '#8B5CF6', bg: '#EDE9FE',
    headline: '9 high-intent delegates show strong buying signals',
    body: 'These prospects have combined multiple engagement actions: opening emails multiple times, clicking the agenda link, and in some cases replying positively. Historical data shows that delegates with a score above 75 are 3× more likely to attend when followed up within 48 hours.',
    action: 'Assign personal follow-up calls or targeted emails to the 9 high-intent delegates within the next 48 hours.',
  },
  {
    icon: '💬', color: '#E7534F', bg: '#FEE2E2',
    headline: 'Positive replies are concentrated in Tier 1 accounts',
    body: '78% of positive replies came from Tier 1 enterprise accounts, which make up only 12% of the prospect list. Neutral and non-interested replies are disproportionately from Tier 3 accounts. This suggests the event positioning resonates strongly with senior decision-makers.',
    action: 'Expand the Tier 1 prospect list and de-prioritise further sends to Tier 3 accounts that have already received 3+ emails.',
  },
  {
    icon: '📉', color: '#14B8A6', bg: '#CCFBF1',
    headline: 'Sequence drop-off steepens sharply after Follow-up 1',
    body: 'Reply rate drops from 18% on the Initial Invite to 12% on Follow-up 1 — a normal decline. But it halves again to just 8% on Follow-up 2. The subject lines for steps 2 and 3 are very similar, which may be causing fatigue. Diversifying the angle (e.g. speaker spotlight vs. agenda focus) could arrest the drop.',
    action: 'Edit the Follow-up 2 and Follow-up 3 subject lines to use a fresh hook before the next wave sends.',
  },
]

// ─── Shared primitives ────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-100 ${className}`}>
      {children}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-1 mb-3">
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{title}</span>
      <span className="text-gray-300 text-[12px] cursor-help select-none" title="More info">ⓘ</span>
    </div>
  )
}

function perfDot(rate: number, hi = 20, lo = 12) {
  if (rate >= hi) return 'bg-green-500'
  if (rate >= lo) return 'bg-amber-400'
  return 'bg-red-500'
}

// ─── Top Matches ──────────────────────────────────────────────────────────────

function TopMatches() {
  return (
    <Card className="p-5 flex flex-col">
      <SectionHeader title="Top Matches" />
      <div className="flex flex-col gap-1 flex-1">
        {TOP_MATCHES.map((m, i) => (
          <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
            <div
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#FFFFFF', fontSize: '11px', fontWeight: '700',
                flexShrink: 0, marginTop: '2px', backgroundColor: m.bg,
              }}
            >
              {m.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#0A0A0A' }}>{m.name}</span>
                <span style={{
                  fontSize: '10px', fontWeight: '600', flexShrink: 0,
                  padding: '1px 5px', borderRadius: '2px', letterSpacing: '0.05em', textTransform: 'uppercase',
                  backgroundColor: m.tier === 'High' ? '#DCFCE7' : '#FEF3C7',
                  color: m.tier === 'High' ? '#166534' : '#92400E',
                }}>
                  {m.tier}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#9A9A9A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title} · {m.company}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                {m.signals.map(s => (
                  <span key={s} style={{ fontSize: '10px', backgroundColor: '#F8F8F8', color: '#5F5F5F', padding: '1px 5px', borderRadius: '2px', border: '1px solid #E4E4E4' }}>{s}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-[14px] font-bold text-[#E7534F]">{m.score}</span>
              <button className="text-[10px] border border-[#E7534F] text-[#E7534F] px-2 py-0.5 rounded hover:bg-[#FEF2F2] transition-colors whitespace-nowrap">
                Follow-up {m.followUp}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-[11px] italic text-gray-400">Top Matches are ranked by our intent model ⓘ</p>
      </div>
    </Card>
  )
}

// ─── Industry Performance ─────────────────────────────────────────────────────

function IndustryPerformance() {
  return (
    <Card className="p-5">
      <SectionHeader title="Industry Performance" />
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left text-[11px] font-medium text-gray-400 pb-2">Industry</th>
            <th className="text-right text-[11px] font-medium text-gray-400 pb-2">Prospects</th>
            <th className="text-right text-[11px] font-medium text-gray-400 pb-2">Replies</th>
            <th className="text-right text-[11px] font-medium text-gray-400 pb-2">Rate</th>
            <th className="pb-2 w-4"></th>
          </tr>
        </thead>
        <tbody>
          {INDUSTRY_PERF.map(row => (
            <tr key={row.industry} className="border-b border-gray-50">
              <td className="py-2 text-[12px] font-medium text-gray-800">{row.industry}</td>
              <td className="py-2 text-right text-[12px] text-gray-500">{row.prospects}</td>
              <td className="py-2 text-right text-[12px] text-gray-500">{row.replies}</td>
              <td className="py-2 text-right text-[12px] font-semibold text-gray-700">{row.rate}%</td>
              <td className="py-2 pl-2">
                <div className={`w-2 h-2 rounded-full ${perfDot(row.rate, 20, 12)}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

// ─── Coverage Insights ────────────────────────────────────────────────────────

function CoverageInsights() {
  return (
    <Card className="p-5 flex flex-col">
      <SectionHeader title="Coverage Insights" />
      <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
        <p className="text-[12px] text-amber-800 leading-relaxed">
          ⚠️ Enterprise accounts (Tier 1) are underrepresented — only 12% of prospects are senior decision-makers at Tier 1 firms.
        </p>
      </div>
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Account tier coverage</div>
      <ResponsiveContainer width="100%" height={120}>
        <PieChart>
          <Pie data={TIER_COVERAGE} cx="50%" cy="50%" innerRadius={38} outerRadius={56} dataKey="value" paddingAngle={2}>
            {TIER_COVERAGE.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1.5 mt-1 flex-1">
        {TIER_COVERAGE.map(t => (
          <div key={t.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
              <span className="text-[12px] text-gray-600">{t.name}</span>
            </div>
            <span className="text-[12px] font-semibold text-gray-700">{t.pct}% ({t.value})</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Top Performing Topics ────────────────────────────────────────────────────

function TopPerformingTopics() {
  const maxRate = Math.max(...TOPICS.map(t => t.rate))
  return (
    <Card className="p-5 flex flex-col">
      <SectionHeader title="Top Performing Topics" />
      <div className="space-y-3 flex-1">
        {TOPICS.map(row => (
          <div key={row.topic}>
            <div className="flex justify-between items-start gap-2 mb-1">
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-gray-800 leading-tight">{row.topic}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{row.speaker}</div>
              </div>
              <span className="text-[12px] font-bold text-gray-700 flex-shrink-0">{row.rate}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#E7534F] rounded-full"
                style={{ width: `${Math.round((row.rate / maxRate) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── AI Insight Cards ─────────────────────────────────────────────────────────

function AIInsightCards() {
  return (
    <div>
      <h2 style={{
        fontSize: '13px', fontWeight: '600', color: '#9CA3AF',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        margin: '0 0 16px',
      }}>
        AI Insights
      </h2>
      <div className="flex flex-col gap-3">
        {AI_INSIGHT_CARDS.map((card, i) => (
          <Card key={i} className="p-5">
            <div className="flex gap-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: card.bg }}
              >
                {card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-gray-900 mb-1">{card.headline}</div>
                <p className="text-[13px] text-gray-600 leading-relaxed">{card.body}</p>
                <p className="text-[12px] text-gray-400 italic mt-2">
                  <span className="font-medium not-italic" style={{ color: card.color }}>Suggested action:</span>{' '}
                  {card.action}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function AIInsightsTab({ campaign: _campaign, prospects: _prospects }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <MockDataBanner>
        Real AI scoring is not connected yet. Top Matches, Industry Performance, Coverage
        Insights, Top Performing Topics, and the AI Insight cards below are all illustrative
        preview data, not live signal from your prospects.
      </MockDataBanner>
      <div className="grid grid-cols-2 gap-4">
        <TopMatches />
        <IndustryPerformance />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <CoverageInsights />
        <TopPerformingTopics />
      </div>
      <AIInsightCards />
    </div>
  )
}
