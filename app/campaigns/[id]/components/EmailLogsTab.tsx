'use client'

// MOCK DATA — replace with real Microsoft Graph data when integration is live

import React, { useState, useEffect, useMemo } from 'react'
import type { Campaign, Prospect } from '@/lib/types'
import { STEPS } from '@/lib/sequence-steps'
import { MockDataBanner, MockDataTag } from '@/components/MockDataBadge'

interface Props {
  campaign: Campaign
  prospects: Prospect[]
  repName: string
}

interface EmailLog {
  id: string
  sentAt: Date
  prospectName: string
  prospectFirstName: string
  prospectEmail: string | null
  company: string
  subject: string
  step: string
  stepLabel: string
  status: 'sent' | 'replied' | 'bounced' | 'declined'
}

const STEP_ORDER_LOG = ['invite_1', 'followup_1', 'followup_2', 'followup_3', 'final']

const STEP_LABELS_LOG: Record<string, string> = {
  invite_1:   'Invite 1',
  followup_1: 'Follow-up 1',
  followup_2: 'Follow-up 2',
  followup_3: 'Follow-up 3',
  final:      'Final',
}

const STEP_DEPTHS_LOG: Record<string, number> = {
  invite_1: 0, followup_1: 1, followup_2: 2, followup_3: 3, final: 4,
}

const STEP_DAY_OFFSETS = [0, 3, 7, 10, 17]

function getSubject(step: string, campaignName: string): string {
  switch (step) {
    case 'invite_1':   return `You're invited — ${campaignName}`
    case 'followup_1': return `Following up — ${campaignName}`
    case 'followup_2': return `One more thought — ${campaignName}`
    case 'followup_3': return `Quick question — ${campaignName}`
    case 'final':      return `Last one from me — ${campaignName}`
    default:           return campaignName
  }
}

function seededHash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0x7fffffff
  return h
}

function nextWorkday(date: Date): Date {
  const d = new Date(date)
  const dow = d.getUTCDay()
  if (dow === 0) d.setUTCDate(d.getUTCDate() + 1)
  if (dow === 6) d.setUTCDate(d.getUTCDate() - 1)
  return d
}

function generateMockLogs(prospects: Prospect[], campaign: Campaign): EmailLog[] {
  const logs: EmailLog[] = []
  const base = new Date(campaign.created_at)

  for (const p of prospects) {
    if (p.sequence_step === 'not_started') continue
    if (p.status === 'queued') continue

    const currentDepth = STEP_DEPTHS_LOG[p.sequence_step] ?? -1
    if (currentDepth < 0) continue

    const hash = seededHash(p.id)
    const firstName = p.full_name?.split(' ')[0] ?? '—'

    for (let d = 0; d <= currentDepth; d++) {
      const step = STEP_ORDER_LOG[d]
      const sentDate = new Date(base)
      sentDate.setUTCDate(sentDate.getUTCDate() + STEP_DAY_OFFSETS[d])
      sentDate.setUTCHours(8 + ((hash + d * 7) % 8))
      sentDate.setUTCMinutes((hash + d * 13) % 60)
      sentDate.setUTCSeconds(0)

      const workday = nextWorkday(sentDate)

      let status: EmailLog['status'] = 'sent'
      if (d === currentDepth) {
        const s = p.status
        if (s === 'replied' || s === 'bounced' || s === 'declined') status = s
      }

      logs.push({
        id: `${p.id}-${step}`,
        sentAt: workday,
        prospectName: p.full_name ?? '—',
        prospectFirstName: firstName,
        prospectEmail: p.email,
        company: p.company ?? '—',
        subject: getSubject(step, campaign.name),
        step,
        stepLabel: STEP_LABELS_LOG[step] ?? step,
        status,
      })
    }
  }

  return logs.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
}

function formatLogDate(d: Date): { date: string; time: string } {
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yy = String(d.getUTCFullYear()).slice(-2)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return { date: `${dd}/${mm}/${yy}`, time: `${hh}:${min}` }
}

function resolveBody(body: string, firstName: string): string {
  return body.replace(/\{\{first_name\}\}/g, firstName)
}

function StatusPill({ status }: { status: EmailLog['status'] }) {
  const map = {
    sent:     { bg: '#FFFBEB', color: '#D97706', label: 'Sent'     },
    replied:  { bg: '#F0FDF4', color: '#16A34A', label: 'Replied'  },
    bounced:  { bg: '#FEF2F2', color: '#DC2626', label: 'Bounced'  },
    declined: { bg: '#F3F4F6', color: '#6B7280', label: 'Declined' },
  }
  const s = map[status]
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '2px', fontSize: '11px',
      fontWeight: '600', backgroundColor: s.bg, color: s.color, whiteSpace: 'nowrap',
      letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  )
}

type SortCol = 'sentAt' | 'prospectName' | 'company' | 'subject' | 'status'
type SortDir = 'asc' | 'desc'

function SortableHeader({
  col, label, sortCol, sortDir, onSort, style,
}: {
  col: SortCol
  label: string
  sortCol: SortCol
  sortDir: SortDir
  onSort: (col: SortCol) => void
  style?: React.CSSProperties
}) {
  const isActive = sortCol === col
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        padding: '11px 16px', textAlign: 'left', fontSize: '12px',
        fontWeight: '600', color: isActive ? '#0A0A0A' : '#9A9A9A',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        whiteSpace: 'nowrap', borderBottom: '1px solid #E4E4E4',
        cursor: 'pointer', userSelect: 'none',
        ...style,
      }}
    >
      {label}
      <span style={{ marginLeft: '4px', fontSize: '10px', color: isActive ? '#E7534F' : 'transparent' }}>
        {sortDir === 'asc' ? '↑' : '↓'}
      </span>
    </th>
  )
}

function ExpandedEmailView({ log, repName }: { log: EmailLog; repName: string }) {
  const [copied, setCopied] = useState(false)
  const step = STEPS.find(s => s.key === log.step)
  const rawBody = step?.body ?? ''
  const body = resolveBody(rawBody, log.prospectFirstName)
  const { date, time } = formatLogDate(log.sentAt)

  function handleCopy() {
    navigator.clipboard.writeText(body).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ backgroundColor: '#F8F8F8', borderTop: '1px solid #E4E4E4', padding: '16px 20px' }}>
      {/* Outlook-style header */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', rowGap: '5px', fontSize: '13px' }}>
          <span style={{ color: '#9A9A9A', fontWeight: '500', paddingTop: '1px' }}>To:</span>
          <span style={{ color: '#0A0A0A' }}>
            {log.prospectName}
            {log.company !== '—' && <span style={{ color: '#5F5F5F' }}> · {log.company}</span>}
            {log.prospectEmail && <span style={{ color: '#5F5F5F' }}> · {log.prospectEmail}</span>}
          </span>

          <span style={{ color: '#9A9A9A', fontWeight: '500', paddingTop: '1px' }}>From:</span>
          <span style={{ color: '#0A0A0A' }}>{repName}</span>

          <span style={{ color: '#9A9A9A', fontWeight: '500', paddingTop: '1px' }}>Sent:</span>
          <span style={{ color: '#5F5F5F' }}>{date} {time}</span>

          <span style={{ color: '#9A9A9A', fontWeight: '500', paddingTop: '1px' }}>Subject:</span>
          <span style={{ color: '#0A0A0A', fontWeight: '600' }}>{log.subject}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #E4E4E4', marginBottom: '14px' }} />

      {/* Email body */}
      <div style={{
        backgroundColor: '#FFFFFF', border: '1px solid #E4E4E4',
        borderRadius: '2px', padding: '16px',
        fontSize: '13px', color: '#0A0A0A', lineHeight: 1.8,
        whiteSpace: 'pre-wrap', fontFamily: 'inherit',
        marginBottom: '12px',
      }}>
        {body}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', color: '#9A9A9A', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MockDataTag />
          Preview only — this email has not actually been sent
        </span>
        <button
          onClick={e => { e.stopPropagation(); handleCopy() }}
          style={{
            padding: '4px 10px', border: '1px solid #E4E4E4', borderRadius: '2px',
            backgroundColor: copied ? '#DCFCE7' : '#FFFFFF',
            color: copied ? '#166534' : '#5F5F5F',
            fontSize: '12px', cursor: 'pointer',
          }}
        >
          {copied ? '✓ Copied' : 'Copy email'}
        </button>
      </div>
    </div>
  )
}

export default function EmailLogsTab({ campaign, prospects, repName }: Props) {
  const [searchInput, setSearchInput]     = useState('')
  const [searchQuery, setSearchQuery]     = useState('')
  const [sortCol, setSortCol]             = useState<SortCol>('sentAt')
  const [sortDir, setSortDir]             = useState<SortDir>('desc')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [hoveredRowId, setHoveredRowId]   = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 150)
    return () => clearTimeout(t)
  }, [searchInput])

  const logs = useMemo(() => generateMockLogs(prospects, campaign), [prospects, campaign])

  const searched = useMemo(() => {
    if (!searchQuery.trim()) return logs
    const q = searchQuery.toLowerCase()
    return logs.filter(log =>
      log.prospectName.toLowerCase().includes(q) ||
      log.company.toLowerCase().includes(q) ||
      log.subject.toLowerCase().includes(q)
    )
  }, [logs, searchQuery])

  const sorted = useMemo(() => {
    const arr = [...searched]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'sentAt':       cmp = a.sentAt.getTime() - b.sentAt.getTime(); break
        case 'prospectName': cmp = a.prospectName.localeCompare(b.prospectName); break
        case 'company':      cmp = a.company.localeCompare(b.company); break
        case 'subject':      cmp = a.subject.localeCompare(b.subject); break
        case 'status':       cmp = a.status.localeCompare(b.status); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [searched, sortCol, sortDir])

  function handleSort(col: SortCol) {
    if (col === sortCol) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  function toggleRow(id: string) {
    setExpandedRowId(prev => prev === id ? null : id)
  }

  const sharedHeaderProps = { sortCol, sortDir, onSort: handleSort }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#0D0D0D', margin: '0 0 4px' }}>
          Email Logs
        </h2>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
          Preview of email activity for this campaign.
        </p>
      </div>

      <MockDataBanner>
        No email sending integration is connected yet. Everything below is illustrative preview
        data — no email in this log has actually been sent.
      </MockDataBanner>

      <input
        type="text"
        value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
        placeholder="Search logs..."
        style={{
          display: 'block', width: '100%', marginBottom: '12px',
          padding: '12px 14px', fontSize: '14px', color: '#0D0D0D',
          backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
          borderRadius: '6px', outline: 'none', boxSizing: 'border-box',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#E7534F' }}
        onBlur={e => { e.currentTarget.style.borderColor = '#E5E5E5' }}
      />

      {logs.length === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: '10px',
          padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>
            No preview email activity for this campaign yet.
          </p>
        </div>
      ) : sorted.length === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: '10px',
          padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>No results found.</p>
        </div>
      ) : (
        <div style={{
          backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: '10px',
          overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#FAFAFA' }}>
                <SortableHeader col="sentAt"       label="Sent Date & Time" {...sharedHeaderProps} />
                <SortableHeader col="prospectName" label="Prospect Name"    {...sharedHeaderProps} />
                <SortableHeader col="company"      label="Company"          {...sharedHeaderProps} />
                <SortableHeader col="subject"      label="Subject Line"     {...sharedHeaderProps} />
                <SortableHeader col="status"       label="Status"           {...sharedHeaderProps} />
                <th style={{ padding: '11px 16px', borderBottom: '1px solid #E5E5E5', width: '36px' }} />
              </tr>
            </thead>
            <tbody>
              {sorted.flatMap((log, i) => {
                const isExpanded = expandedRowId === log.id
                const isHovered  = hoveredRowId === log.id
                const isLast     = i === sorted.length - 1
                const { date, time } = formatLogDate(log.sentAt)

                const rowBg = isExpanded ? '#FEF2F2' : isHovered ? '#F7F6F3' : 'transparent'
                const rowBorder = !isExpanded && !isLast ? '1px solid #F3F4F6' : 'none'

                return [
                  <tr
                    key={`${log.id}-row`}
                    onClick={() => toggleRow(log.id)}
                    onMouseEnter={() => setHoveredRowId(log.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                    style={{
                      borderBottom: rowBorder,
                      backgroundColor: rowBg,
                      boxShadow: isExpanded ? 'inset 4px 0 0 #E7534F' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#0D0D0D' }}>{date}</span>
                      {' '}
                      <span style={{ fontSize: '13px', color: '#9CA3AF' }}>{time}</span>
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '14px', color: '#0D0D0D', whiteSpace: 'nowrap' }}>
                      {log.prospectName}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '14px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                      {log.company}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '14px', color: '#0D0D0D' }}>
                      {log.subject}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <StatusPill status={log.status} />
                    </td>
                    <td style={{ padding: '13px 16px', textAlign: 'right', width: '36px' }}>
                      <span style={{
                        fontSize: '9px', color: isExpanded ? '#E7534F' : '#9CA3AF',
                        display: 'inline-block',
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 200ms ease, color 200ms ease',
                      }}>
                        ▶
                      </span>
                    </td>
                  </tr>,
                  <tr key={`${log.id}-exp`}>
                    <td
                      colSpan={6}
                      style={{
                        padding: 0,
                        borderBottom: isLast ? 'none' : '1px solid #F3F4F6',
                      }}
                    >
                      <div style={{
                        maxHeight: isExpanded ? '700px' : '0',
                        overflow: 'hidden',
                        transition: 'max-height 200ms ease',
                      }}>
                        {isExpanded && <ExpandedEmailView log={log} repName={repName} />}
                      </div>
                    </td>
                  </tr>,
                ]
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
