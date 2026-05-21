'use client'

import { useState, useEffect } from 'react'
import { createCampaign } from '../actions'

interface Props {
  onClose: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #E5E5E5',
  borderRadius: '6px',
  backgroundColor: '#FFFFFF',
  color: '#0D0D0D',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: '500',
  color: '#6B7280',
  marginBottom: '6px',
}

export default function NewCampaignModal({ onClose }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    if (!(formData.get('name') as string).trim()) {
      setError('Campaign name is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await createCampaign(formData)
      onClose()
    } catch {
      setError('Failed to create campaign. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: '440px', backgroundColor: '#FFFFFF',
        borderRadius: '12px', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0D0D0D', margin: 0 }}>New Campaign</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '22px', color: '#6B7280', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="nc-name" style={labelStyle}>
              Campaign Name <span style={{ color: '#E7534F' }}>*</span>
            </label>
            <input id="nc-name" name="name" type="text" required style={inputStyle} />
          </div>

          <div>
            <label htmlFor="nc-theme" style={labelStyle}>Theme</label>
            <input id="nc-theme" name="theme" type="text" style={inputStyle} placeholder="e.g. Digital Transformation Summit" />
          </div>

          <div>
            <label htmlFor="nc-event_date" style={labelStyle}>Event Date</label>
            <input id="nc-event_date" name="event_date" type="date" style={inputStyle} />
          </div>

          <div>
            <label htmlFor="nc-location" style={labelStyle}>Location</label>
            <input id="nc-location" name="location" type="text" style={inputStyle} placeholder="e.g. Sydney, NSW" />
          </div>

          {error && (
            <p style={{ fontSize: '13px', color: '#E7534F', margin: 0 }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '10px', border: '1px solid #E5E5E5',
                borderRadius: '8px', backgroundColor: '#FFFFFF', color: '#6B7280',
                fontSize: '14px', fontWeight: '500', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                flex: 1, padding: '10px', border: 'none',
                borderRadius: '8px',
                backgroundColor: submitting ? '#F3A09F' : '#E7534F',
                color: '#FFFFFF', fontSize: '14px', fontWeight: '600',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
