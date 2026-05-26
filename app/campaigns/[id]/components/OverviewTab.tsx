'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import type { Campaign, Prospect } from '@/lib/types'
import {
  LineChart, Line, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Props {
  campaign: Campaign
  prospects: Prospect[]
}

// ─── MOCK DATA — replace with real data later ─────────────────────────────────

const KPI = {
  totalProspects: 236,
  contacted: 189,
  replies: 42,
  positiveReplies: 18,
  highIntent: 9,
}

const MOMENTUM = {
  score: 73,
  trend: '8 pts vs last 7 days',
  sparkline: [
    { v: 52 }, { v: 55 }, { v: 58 }, { v: 60 }, { v: 63 }, { v: 67 }, { v: 71 }, { v: 73 },
  ],
}

const SEQUENCE_PERF = [
  { step: 'Initial Invite', sent: 189, replyRate: 18, positiveRate: 9 },
  { step: 'Follow-up 1',   sent: 147, replyRate: 12, positiveRate: 5 },
  { step: 'Follow-up 2',   sent: 98,  replyRate: 8,  positiveRate: 3 },
  { step: 'Follow-up 3',   sent: 67,  replyRate: 5,  positiveRate: 2 },
  { step: 'Final',         sent: 41,  replyRate: 3,  positiveRate: 1 },
]

// values sum to 100
const SENTIMENT = [
  { name: 'Positive',       value: 43, color: '#10B981' },
  { name: 'Not Interested', value: 21, color: '#EF4444' },
  { name: 'Neutral',        value: 19, color: '#3B82F6' },
  { name: 'Out of Office',  value: 12, color: '#8B5CF6' },
  { name: 'Referral',       value: 5,  color: '#9CA3AF' },
]

const HEALTH_SCORE = 78
const HEALTH_CHECKS = [
  { label: 'Reply rate (18% — above 15% threshold)',    status: 'good' as const },
  { label: 'Positive sentiment (43% of replies)',       status: 'good' as const },
  { label: 'Sequence progression (80% contacted)',      status: 'good' as const },
  { label: 'Stalled prospects (47 at Follow-up 2)',     status: 'warn' as const },
  { label: 'Low intent prospects (31 below threshold)', status: 'warn' as const },
]

const ACTION_CENTER = [
  { label: 'Replies needing action',  count: 42, linkLabel: 'View Replies →',   tabLink: 'prospects&filter=replied' },
  { label: 'High intent follow-ups',  count: 9,  linkLabel: 'View Prospects →', tabLink: 'prospects' },
  { label: 'Overdue for follow-up',   count: 23, linkLabel: 'View Prospects →', tabLink: 'prospects' },
  { label: 'Stalled at current step', count: 47, linkLabel: 'View Sequence →',  tabLink: 'sequence' },
  { label: 'AI recommended actions',  count: 12, linkLabel: 'View Insights →',  tabLink: 'ai-insights' },
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

// ─── Section 1: KPI Cards ─────────────────────────────────────────────────────

function KpiCards() {
  const pct = (n: number, d: number) => Math.round((n / d) * 100)

  const cards = [
    { icon: '👥', value: KPI.totalProspects, label: 'Total Prospects',       sub: '100% of list' },
    { icon: '📧', value: KPI.contacted,      label: 'Contacted',             sub: `${pct(KPI.contacted, KPI.totalProspects)}% of total` },
    { icon: '💬', value: KPI.replies,        label: 'Replies',               sub: `${pct(KPI.replies, KPI.contacted)}% reply rate` },
    { icon: '✅', value: KPI.positiveReplies,label: 'Positive Replies',      sub: `${pct(KPI.positiveReplies, KPI.replies)}% of replies` },
    { icon: '🔥', value: KPI.highIntent,     label: 'High Intent Delegates', sub: `${pct(KPI.highIntent, KPI.positiveReplies)}% of positive` },
  ]

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1.45fr' }}>
      {cards.map(c => (
        <Card key={c.label} className="p-4">
          <div className="text-xl mb-2">{c.icon}</div>
          <div className="text-3xl font-bold text-gray-900">{c.value}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{c.sub}</div>
          <div className="text-[12px] font-medium text-gray-600 mt-1.5">{c.label}</div>
        </Card>
      ))}
      <Card className="p-4 flex flex-col">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Campaign Momentum</div>
        <div className="text-3xl font-bold text-gray-900">
          {MOMENTUM.score}<span className="text-base font-normal text-gray-400">/100</span>
        </div>
        <div className="text-[11px] text-green-600 font-medium mt-0.5">▲ {MOMENTUM.trend}</div>
        <div className="flex-1 min-h-[48px] mt-3">
          <ResponsiveContainer width="100%" height={48}>
            <LineChart data={MOMENTUM.sparkline}>
              <Line type="monotone" dataKey="v" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}

// ─── Section 2: Campaign Funnel ───────────────────────────────────────────────

const FUNNEL_STAGES = [
  { label: 'Prospects',   value: KPI.totalProspects,  icon: '👥' },
  { label: 'Contacted',   value: KPI.contacted,       icon: '📧' },
  { label: 'Replied',     value: KPI.replies,         icon: '💬' },
  { label: 'Positive',    value: KPI.positiveReplies, icon: '✅' },
  { label: 'High Intent', value: KPI.highIntent,      icon: '🔥' },
]

function CampaignFunnel({ campaignId }: { campaignId: string }) {
  return (
    <Card className="p-5 flex flex-col">
      <SectionHeader title="Campaign Funnel" />
      <div className="flex items-start gap-1 overflow-x-auto pb-2">
        {FUNNEL_STAGES.map((stage, i) => (
          <div key={stage.label} className="flex items-center gap-1">
            <div className="flex flex-col items-center min-w-[72px]">
              <div className="w-11 h-11 rounded-full bg-[#FEF2F2] flex items-center justify-center text-lg mb-1.5">
                {stage.icon}
              </div>
              <div className="text-xl font-bold text-gray-900">{stage.value}</div>
              <div className="text-[11px] font-medium text-gray-500 text-center leading-tight mt-0.5">{stage.label}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {Math.round((stage.value / KPI.totalProspects) * 100)}%
              </div>
            </div>
            {i < FUNNEL_STAGES.length - 1 && (
              <span className="text-gray-300 text-base flex-shrink-0 pb-6">→</span>
            )}
          </div>
        ))}
      </div>
      <div className="rounded-lg p-3 mt-3" style={{ backgroundColor: '#FFF5F5', border: '1px solid #FECACA' }}>
        <div className="text-[13px] font-semibold text-[#E7534F]">
          {KPI.highIntent} delegates are high intent
        </div>
        <div className="text-[12px] text-gray-500 mt-0.5">
          These prospects are most likely to engage or convert.
        </div>
        <Link
          href={`/campaigns/${campaignId}?tab=ai-insights`}
          className="text-[12px] text-[#E7534F] font-medium mt-1 inline-block hover:underline"
        >
          View Top Matches →
        </Link>
      </div>
    </Card>
  )
}

// ─── Section 3: Sequence Performance ─────────────────────────────────────────

function SequencePerformance({ campaignId }: { campaignId: string }) {
  return (
    <Card className="p-5">
      <SectionHeader title="Sequence Performance" />
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left text-[11px] font-medium text-gray-400 pb-2">Step</th>
            <th className="text-right text-[11px] font-medium text-gray-400 pb-2">Sent</th>
            <th className="text-right text-[11px] font-medium text-gray-400 pb-2">Reply %</th>
            <th className="text-right text-[11px] font-medium text-gray-400 pb-2">+ve %</th>
            <th className="pb-2 w-4"></th>
          </tr>
        </thead>
        <tbody>
          {SEQUENCE_PERF.map(row => (
            <tr key={row.step} className="border-b border-gray-50">
              <td className="py-2 text-[12px] font-medium text-gray-800">{row.step}</td>
              <td className="py-2 text-right text-[12px] text-gray-500">{row.sent}</td>
              <td className="py-2 text-right text-[12px] font-semibold text-gray-700">{row.replyRate}%</td>
              <td className="py-2 text-right text-[12px] text-gray-500">{row.positiveRate}%</td>
              <td className="py-2 pl-2">
                <div className={`w-2 h-2 rounded-full ${perfDot(row.replyRate, 15, 8)}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <Link
          href={`/campaigns/${campaignId}?tab=sequence`}
          className="text-[12px] text-[#E7534F] font-medium hover:underline"
        >
          View full sequence analytics →
        </Link>
      </div>
    </Card>
  )
}

// ─── Section 3: Reply Sentiment ───────────────────────────────────────────────

function ReplySentiment({ campaignId }: { campaignId: string }) {
  return (
    <Card className="p-5 flex flex-col">
      <SectionHeader title="Reply Sentiment" />
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie
            data={SENTIMENT}
            cx="50%" cy="50%"
            innerRadius={50} outerRadius={72}
            dataKey="value" paddingAngle={2}
          >
            {SENTIMENT.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1.5 mt-1">
        {SENTIMENT.map(s => (
          <div key={s.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[12px] text-gray-600">{s.name}</span>
            </div>
            <span className="text-[12px] font-semibold text-gray-700">{s.value}%</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <Link
          href={`/campaigns/${campaignId}?tab=prospects&filter=replied`}
          className="text-[12px] text-[#E7534F] font-medium hover:underline"
        >
          View all replies →
        </Link>
      </div>
    </Card>
  )
}

// ─── Section 4: Sequence Health ───────────────────────────────────────────────

function SequenceHealth({ campaignId }: { campaignId: string }) {
  const r = 44
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - HEALTH_SCORE / 100)

  return (
    <Card className="p-5 flex flex-col">
      <SectionHeader title="Sequence Health" />
      <div className="flex justify-center my-2">
        <svg width="110" height="110" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r={r} fill="none" stroke="#F3F4F6" strokeWidth="10" />
          <circle
            cx="55" cy="55" r={r}
            fill="none" stroke="#10B981" strokeWidth="10"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" transform="rotate(-90 55 55)"
          />
          <text x="55" y="52" textAnchor="middle" fontSize="20" fontWeight="700" fill="#111827">
            {HEALTH_SCORE}%
          </text>
          <text x="55" y="68" textAnchor="middle" fontSize="11" fill="#6B7280">Healthy</text>
        </svg>
      </div>
      <div className="space-y-2 flex-1">
        {HEALTH_CHECKS.map(h => (
          <div key={h.label} className="flex items-start gap-2">
            <span className="text-[13px] flex-shrink-0">{h.status === 'good' ? '✅' : '⚠️'}</span>
            <span className={`text-[12px] leading-tight ${h.status === 'good' ? 'text-gray-700' : 'text-amber-700'}`}>
              {h.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <Link
          href={`/campaigns/${campaignId}?tab=sequence`}
          className="text-[12px] text-[#E7534F] font-medium hover:underline"
        >
          View health details →
        </Link>
      </div>
    </Card>
  )
}

// ─── Section 4: Action Center ─────────────────────────────────────────────────

function ActionCenter({ campaignId }: { campaignId: string }) {
  return (
    <Card className="p-5 flex flex-col">
      <SectionHeader title="Action Center" />
      <div className="flex flex-col gap-3 flex-1">
        {ACTION_CENTER.map(item => (
          <div key={item.label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="min-w-[28px] h-6 rounded-full bg-[#E7534F] text-white text-[11px] font-bold flex items-center justify-center px-2 flex-shrink-0">
                {item.count}
              </span>
              <span className="text-[12px] text-gray-700 leading-tight truncate">{item.label}</span>
            </div>
            <Link
              href={`/campaigns/${campaignId}?tab=${item.tabLink}`}
              className="text-[11px] text-[#E7534F] font-medium hover:underline flex-shrink-0"
            >
              {item.linkLabel}
            </Link>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <Link
          href={`/campaigns/${campaignId}?tab=prospects`}
          className="text-[12px] text-[#E7534F] font-medium hover:underline"
        >
          View all prospects →
        </Link>
      </div>
    </Card>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function OverviewTab({ campaign, prospects: _prospects }: Props) {
  const id = campaign.id
  return (
    <div className="flex flex-col gap-5">
      <KpiCards />

      <div className="grid grid-cols-1 gap-4">
        <CampaignFunnel campaignId={id} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <SequencePerformance campaignId={id} />
        <ReplySentiment campaignId={id} />
        <div className="grid gap-4 content-start">
          <SequenceHealth campaignId={id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <ActionCenter campaignId={id} />
      </div>
    </div>
  )
}
