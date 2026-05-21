'use client'

import { useState } from 'react'
import { updateCampaign } from '../actions'
import type { Campaign } from '@/lib/types'

interface Props {
  campaign: Campaign
}

export default function SettingsTab({ campaign }: Props) {
  const [name, setName] = useState(campaign.name)
  const [theme, setTheme] = useState(campaign.theme ?? '')
  const [eventDate, setEventDate] = useState(campaign.event_date ?? '')
  const [location, setLocation] = useState(campaign.location ?? '')
  const [eventBrief, setEventBrief] = useState(campaign.event_brief ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setSaved(false)
    try {
      await updateCampaign(campaign.id, {
        name: name.trim(),
        theme: theme.trim() || null,
        event_date: eventDate || null,
        location: location.trim() || null,
        event_brief: eventBrief.trim() || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1px solid #E5E5E5',
    borderRadius: '8px', fontSize: '14px', color: '#0D0D0D',
    backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: '600',
    color: '#6B7280', marginBottom: '6px', textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
      borderRadius: '10px', padding: '28px', maxWidth: '560px',
    }}>
      <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#0D0D0D', marginBottom: '24px' }}>
        Campaign Settings
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <label style={labelStyle}>Campaign Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            style={inputStyle}
            placeholder="e.g. Gartner Data & AI 2025"
          />
        </div>

        <div>
          <label style={labelStyle}>Theme</label>
          <input
            type="text"
            value={theme}
            onChange={e => setTheme(e.target.value)}
            style={inputStyle}
            placeholder="e.g. AI in Financial Services"
          />
        </div>

        <div>
          <label style={labelStyle}>Event Date</label>
          <input
            type="date"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Location</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            style={inputStyle}
            placeholder="e.g. Sydney, NSW"
          />
        </div>

        <div>
          <label style={labelStyle}>Event Brief</label>
          <textarea
            value={eventBrief}
            onChange={e => setEventBrief(e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="Brief description of the event, its goals, and target audience…"
          />
        </div>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          style={{
            padding: '9px 20px', border: 'none', borderRadius: '8px',
            backgroundColor: saving || !name.trim() ? '#F3A09F' : '#E7534F',
            color: '#FFFFFF', fontSize: '14px', fontWeight: '600',
            cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && (
          <span style={{ fontSize: '13px', color: '#16A34A' }}>Saved</span>
        )}
      </div>
    </div>
  )
}
