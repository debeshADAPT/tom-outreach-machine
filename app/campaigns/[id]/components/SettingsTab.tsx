'use client'

import { useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { TextStyle } from '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'
import { updateCampaign, saveCampaignTemplate } from '../actions'
import type { Campaign } from '@/lib/types'
import { STEPS, type SequenceStep } from '@/lib/sequence-steps'

interface Props {
  campaign: Campaign
}

// ─── Custom FontSize TipTap extension ────────────────────────────────────────

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions: () => ({ types: ['textStyle'] }),
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize || null,
          renderHTML: (attrs: { fontSize?: string }) => {
            if (!attrs.fontSize) return {}
            return { style: `font-size: ${attrs.fontSize}` }
          },
        },
      },
    }]
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: size }).run(),
    } as any
  },
})

// ─── SequenceTemplateCard ─────────────────────────────────────────────────────

const toolbarBtnStyle: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid #E5E5E5', borderRadius: '4px',
  backgroundColor: '#FFFFFF', color: '#374151', fontSize: '12px',
  cursor: 'pointer', lineHeight: 1,
}

function SequenceTemplateCard({ step, campaign }: { step: SequenceStep; campaign: Campaign }) {
  const [expanded, setExpanded] = useState(false)
  const [subject, setSubject] = useState(
    campaign.email_templates?.[step.key]?.subject ?? step.subject
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const initBody = campaign.email_templates?.[step.key]?.body ?? step.body
  const hasCustom = !!(campaign.email_templates?.[step.key])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextStyle,
      FontSize,
    ],
    content: initBody,
    editorProps: {
      attributes: {
        style: 'min-height: 160px; padding: 12px 16px; font-size: 13px; line-height: 1.7; outline: none; font-family: inherit;',
      },
    },
  })

  async function handleSave() {
    if (!editor) return
    setSaving(true)
    setSaved(false)
    try {
      await saveCampaignTemplate(campaign.id, step.key, { subject, body: editor.getHTML() })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
      borderRadius: '10px', overflow: 'hidden', marginBottom: '10px',
    }}>
      {/* Card header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 16px', cursor: 'pointer',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{
          width: '22px', height: '22px', borderRadius: '50%',
          backgroundColor: '#E7534F', color: '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: '700', flexShrink: 0,
        }}>
          {step.num}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#0D0D0D' }}>{step.name}</div>
          {!expanded && (
            <div style={{
              fontSize: '12px', color: '#9CA3AF', marginTop: '2px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {subject}
            </div>
          )}
        </div>
        {hasCustom && (
          <span style={{
            padding: '2px 8px', borderRadius: '20px', fontSize: '11px',
            backgroundColor: '#FEF2F2', color: '#E7534F', flexShrink: 0,
          }}>
            ✎ customised
          </span>
        )}
        <button
          onClick={e => { e.stopPropagation(); setExpanded(prev => !prev) }}
          style={{
            padding: '5px 12px', border: '1px solid #E5E5E5', borderRadius: '6px',
            backgroundColor: expanded ? '#F7F6F3' : '#FFFFFF',
            color: '#6B7280', fontSize: '12px', cursor: 'pointer', flexShrink: 0,
          }}
        >
          {expanded ? 'Collapse' : 'Edit'}
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div style={{ borderTop: '1px solid #E5E5E5' }}>
          {/* Subject */}
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid #E5E5E5',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '12px', color: '#9CA3AF', width: '52px', flexShrink: 0 }}>Subject:</span>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{
                flex: 1, fontSize: '13px', color: '#0D0D0D',
                border: 'none', outline: 'none', backgroundColor: 'transparent',
              }}
            />
          </div>

          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap',
            padding: '6px 12px', borderBottom: '1px solid #E5E5E5',
            backgroundColor: '#FAFAFA',
          }}>
            <button
              onClick={() => editor?.chain().focus().toggleBold().run()}
              style={{ ...toolbarBtnStyle, fontWeight: '700', backgroundColor: editor?.isActive('bold') ? '#F3F3F1' : '#FFFFFF' }}
            >B</button>
            <button
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              style={{ ...toolbarBtnStyle, fontStyle: 'italic', backgroundColor: editor?.isActive('italic') ? '#F3F3F1' : '#FFFFFF' }}
            >I</button>
            <button
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              style={{ ...toolbarBtnStyle, textDecoration: 'underline', backgroundColor: editor?.isActive('underline') ? '#F3F3F1' : '#FFFFFF' }}
            >U</button>
            <button
              onClick={() => {
                const url = window.prompt('Link URL', 'https://')
                if (url) editor?.chain().focus().setLink({ href: url }).run()
              }}
              style={{ ...toolbarBtnStyle, backgroundColor: editor?.isActive('link') ? '#F3F3F1' : '#FFFFFF' }}
            >🔗</button>
            <button
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              style={{ ...toolbarBtnStyle, backgroundColor: editor?.isActive('bulletList') ? '#F3F3F1' : '#FFFFFF' }}
            >• List</button>
          </div>

          {/* Editor body */}
          <div style={{ borderBottom: '1px solid #E5E5E5' }}>
            <EditorContent editor={editor} />
          </div>

          {/* Footer: info note + save */}
          <div style={{
            padding: '10px 16px', backgroundColor: '#FAFAFA',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <span style={{ fontSize: '12px', color: '#9CA3AF', flex: 1 }}>
              Changes apply to all prospects without a custom email for this step.
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '6px 16px', border: 'none', borderRadius: '6px',
                backgroundColor: saved ? '#DCFCE7' : saving ? '#F3A09F' : '#E7534F',
                color: saved ? '#166534' : '#FFFFFF',
                fontSize: '13px', fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer', flexShrink: 0,
              }}
            >
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save template'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

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
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '32px', alignItems: 'start' }}>
      {/* Left: Campaign Settings */}
      <div style={{
        backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
        borderRadius: '10px', padding: '28px',
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
          {saved && <span style={{ fontSize: '13px', color: '#16A34A' }}>Saved</span>}
        </div>
      </div>

      {/* Right: Sequence Templates */}
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#0D0D0D', marginBottom: '6px' }}>
          Sequence Templates
        </h3>
        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
          Default email templates for each outreach step. Prospects with custom emails override these.
        </p>
        {STEPS.map(step => (
          <SequenceTemplateCard key={step.key} step={step} campaign={campaign} />
        ))}
      </div>
    </div>
  )
}
