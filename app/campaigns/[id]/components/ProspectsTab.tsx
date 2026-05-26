'use client'

import type { Campaign, Prospect } from '@/lib/types'
import ProspectsTable from './ProspectsTable'

interface Props {
  campaign: Campaign
  prospects: Prospect[]
}

export default function ProspectsTab({ campaign, prospects }: Props) {
  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#0D0D0D', margin: '9px 0 0 0' }}>
          Prospects
          {prospects.length > 0 && (
            <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: '400', color: '#9CA3AF' }}>
              ({prospects.length})
            </span>
          )}
        </h2>
      </div>

      {prospects.length > 0 ? (
        <ProspectsTable prospects={prospects} />
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: '10px', padding: '60px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>
            No prospects yet. Use the Prospects button above to import.
          </p>
        </div>
      )}
    </div>
  )
}
