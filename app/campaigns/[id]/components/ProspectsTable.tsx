'use client'

// MOCK DATA — replace with real AI scoring when Salesforce integration is live

import { useState, useEffect, useMemo } from 'react'
import type { Prospect } from '@/lib/types'
import { MockDataTag } from '@/components/MockDataBadge'

interface Props {
  prospects: Prospect[]
}

function getMockMatchScore(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0x7fffffff
  const r = h % 100
  if (r < 15) return 45 + (r % 15)
  if (r < 75) return 60 + (r % 26)
  return 86 + (r % 10)
}

function MatchBadge({ score }: { score: number }) {
  let bg = '#FEF2F2', color = '#DC2626'
  if (score >= 80) { bg = '#F0FDF4'; color = '#16A34A' }
  else if (score >= 60) { bg = '#FFFBEB'; color = '#D97706' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '2px 8px', borderRadius: '2px',
      fontSize: '11px', fontWeight: '600', backgroundColor: bg, color,
      letterSpacing: '0.03em',
    }}>
      {score}%
      <MockDataTag style={{ backgroundColor: 'rgba(255,255,255,0.55)' }} />
    </span>
  )
}

function PillTag({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: '2px',
      backgroundColor: '#F8F8F8', color: '#9A9A9A', fontSize: '11px',
      fontWeight: '500', marginRight: '4px', marginBottom: '2px',
      border: '1px solid #E4E4E4',
    }}>
      {label}
    </span>
  )
}

export default function ProspectsTable({ prospects }: Props) {
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(searchInput), 150)
    return () => clearTimeout(id)
  }, [searchInput])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return prospects
    const q = searchQuery.toLowerCase()
    return prospects.filter(p =>
      (p.full_name ?? '').toLowerCase().includes(q) ||
      (p.company ?? '').toLowerCase().includes(q) ||
      (p.title ?? '').toLowerCase().includes(q)
    )
  }, [prospects, searchQuery])

  const thStyle: React.CSSProperties = {
    padding: '10px 16px', textAlign: 'left', fontSize: '11px',
    fontWeight: '600', color: '#9A9A9A', textTransform: 'uppercase',
    letterSpacing: '0.08em', whiteSpace: 'nowrap',
  }

  return (
    <div>
      <input
        type="text"
        value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
        placeholder="Search prospects..."
        style={{
          display: 'block', width: '100%', marginBottom: '12px',
          padding: '10px 14px', fontSize: '13px', color: '#0A0A0A',
          backgroundColor: '#FFFFFF', border: '1px solid #E4E4E4',
          borderRadius: '2px', outline: 'none', boxSizing: 'border-box',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#E7534F' }}
        onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E4' }}
      />

      {filtered.length > 0 ? (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E4E4E4', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E4E4E4', backgroundColor: '#FAFAFA' }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Job Title</th>
                <th style={thStyle}>History</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>% Match</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const isLast = i === filtered.length - 1
                const score = getMockMatchScore(p.id)
                return (
                  <tr
                    key={p.id}
                    style={{ borderBottom: isLast ? 'none' : '1px solid #E4E4E4' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#F8F8F8' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                  >
                    <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '600', color: '#0A0A0A', whiteSpace: 'nowrap' }}>
                      {p.full_name ?? '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', color: '#5F5F5F', whiteSpace: 'nowrap' }}>
                      {p.company ?? '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', color: '#5F5F5F' }}>
                      {p.title ?? '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                        {(p.history_tags ?? []).map(tag => <PillTag key={tag} label={tag} />)}
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <MatchBadge score={score} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E4E4E4', padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#9A9A9A' }}>No results found.</p>
        </div>
      )}
    </div>
  )
}
