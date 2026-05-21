'use client'

import { useState } from 'react'
import { prospectStatusBadge, sequenceStepLabel } from '@/lib/utils'
import type { Prospect } from '@/lib/types'

const PAGE_SIZE = 50

interface Props {
  prospects: Prospect[]
}

function PillTag({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '20px',
      backgroundColor: '#F3F3F1', color: '#6B7280', fontSize: '11px',
      fontWeight: '500', marginRight: '4px', marginBottom: '2px',
    }}>
      {label}
    </span>
  )
}

export default function ProspectsTable({ prospects }: Props) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(prospects.length / PAGE_SIZE)
  const slice = prospects.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const thStyle: React.CSSProperties = {
    padding: '11px 16px', textAlign: 'left', fontSize: '11px',
    fontWeight: '600', color: '#6B7280', textTransform: 'uppercase',
    letterSpacing: '0.06em',
  }

  return (
    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: '10px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Company</th>
            <th style={thStyle}>Industry</th>
            <th style={thStyle}>History</th>
            <th style={thStyle}>Sequence Step</th>
            <th style={thStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {slice.map((p, i) => {
            const badge = prospectStatusBadge(p.status)
            const isReplied = p.status === 'replied'
            const isLast = i === slice.length - 1
            return (
              <tr
                key={p.id}
                style={{
                  borderBottom: isLast ? 'none' : '1px solid #E5E5E5',
                  borderLeft: isReplied ? '3px solid #22C55E' : '3px solid transparent',
                  backgroundColor: isReplied ? '#F0FDF4' : 'transparent',
                }}
              >
                <td style={{ padding: '13px 16px', fontSize: '14px', fontWeight: '500', color: '#0D0D0D' }}>
                  {p.full_name ?? '—'}
                </td>
                <td style={{ padding: '13px 16px', fontSize: '14px', color: '#6B7280' }}>
                  {p.company ?? '—'}
                </td>
                <td style={{ padding: '13px 16px', fontSize: '14px', color: '#6B7280' }}>
                  {p.industry ?? '—'}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  {(p.history_tags ?? []).map(tag => <PillTag key={tag} label={tag} />)}
                </td>
                <td style={{ padding: '13px 16px', fontSize: '14px', color: '#0D0D0D' }}>
                  {sequenceStepLabel(p.sequence_step)}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '12px',
                    fontWeight: '500', backgroundColor: badge.bg, color: badge.color,
                  }}>
                    {badge.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderTop: '1px solid #E5E5E5',
        }}>
          <span style={{ fontSize: '13px', color: '#6B7280' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, prospects.length)} of {prospects.length}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: '5px 12px', border: '1px solid #E5E5E5', borderRadius: '6px',
                backgroundColor: '#FFFFFF', color: '#6B7280', fontSize: '13px',
                cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1,
              }}
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              style={{
                padding: '5px 12px', border: '1px solid #E5E5E5', borderRadius: '6px',
                backgroundColor: '#FFFFFF', color: '#6B7280', fontSize: '13px',
                cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer',
                opacity: page === totalPages - 1 ? 0.4 : 1,
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
