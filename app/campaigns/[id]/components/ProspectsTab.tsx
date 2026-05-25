'use client'

import { useState } from 'react'
import type { Campaign, Prospect } from '@/lib/types'
import { sequenceStepLabel } from '@/lib/utils'
import UploadCSV from './UploadCSV'
import ProspectsTable from './ProspectsTable'
import { bulkStartSequences } from '../actions'

type StatusFilter = 'All' | 'queued' | 'sent' | 'replied' | 'bounced'

interface Props {
  campaign: Campaign
  prospects: Prospect[]
}

const FILTER_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'All' },
  { label: 'Queued', value: 'queued' },
  { label: 'Sent', value: 'sent' },
  { label: 'Replied', value: 'replied' },
  { label: 'Bounced', value: 'bounced' },
]

function exportToCSV(rows: Prospect[], campaignName: string) {
  const headers = ['Name', 'Email', 'Company', 'Industry', 'Title', 'Org Size', 'Annual Revenue', 'Sequence Step', 'Status']
  const data = rows.map(p => [
    p.full_name ?? '',
    p.email ?? '',
    p.company ?? '',
    p.industry ?? '',
    p.title ?? '',
    p.org_size ?? '',
    p.annual_revenue ?? '',
    sequenceStepLabel(p.sequence_step),
    p.status,
  ])
  const csv = [headers, ...data]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${campaignName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-prospects.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ProspectsTab({ campaign, prospects }: Props) {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('All')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStarting, setBulkStarting] = useState(false)

  const filtered = activeFilter === 'All'
    ? prospects
    : prospects.filter(p => p.status === activeFilter)

  function handleFilterChange(filter: StatusFilter) {
    setActiveFilter(filter)
    setSelectedIds(new Set())
  }

  function handleToggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleToggleAll(ids: string[]) {
    setSelectedIds(prev => {
      const allSelected = ids.every(id => prev.has(id))
      const next = new Set(prev)
      if (allSelected) {
        ids.forEach(id => next.delete(id))
      } else {
        ids.forEach(id => next.add(id))
      }
      return next
    })
  }

  const selectedNotStarted = [...selectedIds].filter(id =>
    prospects.find(p => p.id === id)?.sequence_step === 'not_started'
  )

  async function handleBulkStart() {
    if (selectedNotStarted.length === 0) return
    setBulkStarting(true)
    try {
      await bulkStartSequences(selectedNotStarted)
      setSelectedIds(new Set())
    } finally {
      setBulkStarting(false)
    }
  }

  return (
    <div>
      {/* Header row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: '16px',
      }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#0D0D0D', margin: '9px 0 0 0' }}>
          Prospects
          {prospects.length > 0 && (
            <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: '400', color: '#9CA3AF' }}>
              ({prospects.length})
            </span>
          )}
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          {prospects.length > 0 && (
            <button
              onClick={() => exportToCSV(filtered, campaign.name)}
              style={{
                padding: '9px 16px', border: '1px solid #E7534F', borderRadius: '8px',
                backgroundColor: '#FFFFFF', color: '#E7534F', fontSize: '14px',
                fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
            >
              Export CSV
            </button>
          )}
          <UploadCSV campaignId={campaign.id} />
        </div>
      </div>

      {/* Filter pills */}
      {prospects.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleFilterChange(opt.value)}
              style={{
                padding: '5px 14px', borderRadius: '20px', border: '1px solid',
                borderColor: activeFilter === opt.value ? '#E7534F' : '#E5E5E5',
                backgroundColor: activeFilter === opt.value ? '#E7534F' : '#FFFFFF',
                color: activeFilter === opt.value ? '#FFFFFF' : '#6B7280',
                fontSize: '13px', fontWeight: '500', cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedNotStarted.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '10px 16px', marginBottom: '12px',
          backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
          borderRadius: '8px',
        }}>
          <span style={{ fontSize: '13px', color: '#6B7280' }}>
            {selectedIds.size} prospect{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBulkStart}
            disabled={bulkStarting}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '6px',
              backgroundColor: bulkStarting ? '#F3A09F' : '#E7534F',
              color: '#FFFFFF', fontSize: '13px', fontWeight: '600',
              cursor: bulkStarting ? 'not-allowed' : 'pointer',
            }}
          >
            {bulkStarting
              ? 'Starting…'
              : `Start Sequence for ${selectedNotStarted.length} prospect${selectedNotStarted.length !== 1 ? 's' : ''}`}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{
              fontSize: '13px', color: '#9CA3AF',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Table or empty states */}
      {filtered.length > 0 ? (
        <ProspectsTable
          key={activeFilter}
          prospects={filtered}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleAll={handleToggleAll}
        />
      ) : prospects.length === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
          borderRadius: '10px', padding: '60px 24px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>
            No prospects yet. Upload a CSV above to get started.
          </p>
        </div>
      ) : (
        <div style={{
          backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
          borderRadius: '10px', padding: '40px 24px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>
            No prospects match this filter.
          </p>
        </div>
      )}
    </div>
  )
}
