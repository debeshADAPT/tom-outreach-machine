import type { Prospect } from '@/lib/types'
import UploadCSV from './UploadCSV'
import ProspectsTable from './ProspectsTable'

interface Props {
  campaignId: string
  prospects: Prospect[]
}

export default function ProspectsTab({ campaignId, prospects }: Props) {
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: '20px',
      }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#0D0D0D', margin: '9px 0 0 0' }}>
          Prospects
        </h2>
        <UploadCSV campaignId={campaignId} />
      </div>
      {prospects.length > 0 ? (
        <ProspectsTable prospects={prospects} />
      ) : (
        <div style={{
          backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
          borderRadius: '10px', padding: '60px 24px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>
            No prospects yet. Upload a CSV above to get started.
          </p>
        </div>
      )}
    </div>
  )
}
