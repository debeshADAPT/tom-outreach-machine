'use client'

// MOCK DATA — replace with real AI scoring when Salesforce integration is live

import { useState, useEffect, useMemo } from 'react'
import type { Prospect } from '@/lib/types'

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
      display: 'inline-block', padding: '4px 10px', borderRadius: '20px',
      fontSize: '11px', fontWeight: '500', backgroundColor: bg, color,
    }}>
      {score}%
    </span>
  )
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
    padding: '11px 16px', textAlign: 'left', fontSize: '11px',
    fontWeight: '600', color: '#6B7280', textTransform: 'uppercase',
    letterSpacing: '0.06em', whiteSpace: 'nowrap',
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
          padding: '12px 14px', fontSize: '14px', color: '#0D0D0D',
          backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
          borderRadius: '6px', outline: 'none', boxSizing: 'border-box',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#E7534F' }}
        onBlur={e => { e.currentTarget.style.borderColor = '#E5E5E5' }}
      />

      {filtered.length > 0 ? (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E5E5', backgroundColor: '#FAFAFA' }}>
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
                    style={{ borderBottom: isLast ? 'none' : '1px solid #E5E5E5' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#F7F6F3' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                  >
                    <td style={{ padding: '13px 16px', fontSize: '14px', fontWeight: '600', color: '#0D0D0D', whiteSpace: 'nowrap' }}>
                      {p.full_name ?? '—'}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '14px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                      {p.company ?? '—'}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '14px', color: '#6B7280' }}>
                      {p.title ?? '—'}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                        {(p.history_tags ?? []).map(tag => <PillTag key={tag} label={tag} />)}
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                      <MatchBadge score={score} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: '10px', padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>No results found.</p>
        </div>
      )}
    </div>
  )
}
