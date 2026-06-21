'use client'

import { useState, useEffect } from 'react'
import { createCampaign } from '../actions'

interface Props {
  onClose: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #E4E4E4',
  borderRadius: '2px',
  backgroundColor: '#FFFFFF',
  color: '#0A0A0A',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: '600',
  color: '#5F5F5F',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
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
        backgroundColor: 'rgba(0,0,0,0.4)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: '440px', backgroundColor: '#FFFFFF',
        borderRadius: '4px', padding: '28px',
        border: '1px solid #E4E4E4',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0A0A0A', margin: 0, letterSpacing: '-0.01em' }}>New Campaign</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', color: '#9A9A9A', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
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
                flex: 1, padding: '9px', border: '1px solid #E4E4E4',
                borderRadius: '2px', backgroundColor: '#FFFFFF', color: '#5F5F5F',
                fontSize: '13px', fontWeight: '500', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                flex: 1, padding: '9px', border: 'none',
                borderRadius: '2px',
                backgroundColor: submitting ? '#F3A09F' : '#E7534F',
                color: '#FFFFFF', fontSize: '13px', fontWeight: '600',
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
