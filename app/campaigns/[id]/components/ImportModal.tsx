'use client'

import { createPortal } from 'react-dom'
import UploadCSV from './UploadCSV'

interface Props {
  campaignId: string
  onClose: () => void
}

export default function ImportModal({ campaignId, onClose }: Props) {
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF', borderRadius: '12px',
          width: '100%', maxWidth: '520px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #E5E5E5',
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0D0D0D', margin: 0 }}>
            Import Prospects
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '20px', color: '#9CA3AF', lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '28px', height: '28px',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          <UploadCSV campaignId={campaignId} />
        </div>
      </div>
    </div>,
    document.body
  )
}
