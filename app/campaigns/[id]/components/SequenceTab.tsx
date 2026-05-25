'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { TextStyle } from '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'
import {
  toggleProspectPaused,
  moveProspectToStep,
  bulkMoveToStep,
  bulkPause,
  saveCustomEmail,
  saveProspectCustomDelay,
} from '../actions'
import type { Prospect, Campaign } from '@/lib/types'
import { prospectStatusBadge } from '@/lib/utils'
import { STEPS, STEP_ORDER, STEP_DEPTH, type StepKey } from '@/lib/sequence-steps'

interface Props {
  prospects: Prospect[]
  campaign: Campaign
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DELAY_GAP_KEYS = [
  'invite_to_followup1',
  'followup1_to_followup2',
  'followup2_to_followup3',
  'followup3_to_final',
]

const DEFAULT_DELAYS: Record<string, number> = {
  invite_to_followup1: 3,
  followup1_to_followup2: 4,
  followup2_to_followup3: 3,
  followup3_to_final: 7,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortActive(list: Prospect[]): Prospect[] {
  return [...list].sort((a, b) => {
    if (a.status === 'replied' && b.status !== 'replied') return -1
    if (b.status === 'replied' && a.status !== 'replied') return 1
    const aD = STEP_DEPTH[a.sequence_step] ?? -1
    const bD = STEP_DEPTH[b.sequence_step] ?? -1
    if (aD !== bD) return bD - aD
    return (a.full_name ?? '').localeCompare(b.full_name ?? '')
  })
}

function computeStepOffsets(delays: Record<string, number>): Record<string, number> {
  const d0 = delays['invite_to_followup1'] ?? DEFAULT_DELAYS['invite_to_followup1']
  const d1 = delays['followup1_to_followup2'] ?? DEFAULT_DELAYS['followup1_to_followup2']
  const d2 = delays['followup2_to_followup3'] ?? DEFAULT_DELAYS['followup2_to_followup3']
  const d3 = delays['followup3_to_final'] ?? DEFAULT_DELAYS['followup3_to_final']
  return {
    invite_1: 0,
    followup_1: d0,
    followup_2: d0 + d1,
    followup_3: d0 + d1 + d2,
    final: d0 + d1 + d2 + d3,
  }
}

function formatShortDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

function formatDateDisplay(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = (h % 12) || 12
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} at ${h12}:${m}${ampm}`
}

function getSentStatus(stepKey: string, prospect: Prospect, campaignCreatedAt: string, offsets: Record<string, number>): string {
  const currentDepth = STEP_DEPTH[prospect.sequence_step] ?? -1
  const stepDepth = STEP_DEPTH[stepKey] ?? -1
  if (stepDepth < currentDepth) {
    const d = new Date(campaignCreatedAt)
    d.setDate(d.getDate() + (offsets[stepKey] ?? 0))
    return `Sent ${formatDateDisplay(d)}`
  }
  if (stepDepth === currentDepth) {
    return prospect.status === 'sent' ? 'Sending…' : 'Scheduled'
  }
  return 'Not scheduled yet'
}

function resolveBody(body: string, prospect: Prospect): string {
  const first = prospect.full_name?.split(' ')[0] ?? '{{first_name}}'
  const co = prospect.company ?? '{{company}}'
  return body.replace(/\{\{first_name\}\}/g, first).replace(/\{\{company\}\}/g, co)
}

function htmlToText(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '')
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent ?? div.innerText ?? ''
}

// ─── HistoryTags ──────────────────────────────────────────────────────────────

function HistoryTags({ tags }: { tags: string[] | null }) {
  const [expanded, setExpanded] = useState(false)
  if (!tags || tags.length === 0) return null
  const visible = expanded || tags.length <= 2 ? tags : tags.slice(0, 2)
  const overflow = tags.length - 2

  const tagStyle: React.CSSProperties = {
    backgroundColor: '#F1EFE8', color: '#5F5E5A',
    fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
    whiteSpace: 'nowrap', flexShrink: 0,
  }

  return (
    <>
      {visible.map(tag => (
        <span key={tag} style={tagStyle}>{tag}</span>
      ))}
      {!expanded && overflow > 0 && (
        <button
          onClick={() => setExpanded(true)}
          style={{ ...tagStyle, border: 'none', cursor: 'pointer' }}
        >
          +{overflow} more
        </button>
      )}
    </>
  )
}

// ─── DayGapBox ────────────────────────────────────────────────────────────────

function DayGapBox({ value, isCustom, onChange }: {
  value: number
  isCustom: boolean
  onChange: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  function commit() {
    const n = parseInt(draft, 10)
    if (!isNaN(n) && n > 0) onChange(n)
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', margin: '0 4px', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>+</span>
        <input
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          autoFocus
          min={1}
          style={{
            width: '36px', padding: '2px 4px',
            border: '1px solid #E7534F', borderRadius: '4px',
            fontSize: '11px', textAlign: 'center', outline: 'none',
          }}
        />
        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>days</span>
      </div>
    )
  }

  return (
    <div
      onClick={() => { setDraft(String(value)); setEditing(true) }}
      title="Click to edit delay"
      style={{
        display: 'flex', alignItems: 'center', gap: '3px',
        margin: '0 4px', cursor: 'pointer', flexShrink: 0,
        padding: '2px 6px', borderRadius: '4px',
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F7F6F3')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <span style={{ fontSize: '11px', color: isCustom ? '#E7534F' : '#9CA3AF' }}>+{value}d</span>
      <span style={{ fontSize: '10px', color: '#D1D5DB' }}>✎</span>
    </div>
  )
}

// ─── StepPills ────────────────────────────────────────────────────────────────

function StepPills({
  prospect,
  campaignDelays,
  onPillClick,
  onMoveToStep,
  onDelayChange,
  campaignCreatedAt,
}: {
  prospect: Prospect
  campaignDelays: Record<string, number>
  onPillClick: (p: Prospect, stepKey: string) => void
  onMoveToStep: (id: string, step: string) => void
  onDelayChange: (prospectId: string, gapKey: string, value: number) => void
  campaignCreatedAt: string
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    const close = () => setDropdownOpen(false)
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [dropdownOpen])

  const currentIdx = STEP_ORDER.indexOf(prospect.sequence_step as StepKey)
  const prospectCustomDelays = prospect.custom_delays ?? {}

  // Effective delays: prospect overrides > campaign > defaults
  const effectiveDelays: Record<string, number> = {}
  for (const key of DELAY_GAP_KEYS) {
    effectiveDelays[key] = prospectCustomDelays[key] ?? campaignDelays[key] ?? DEFAULT_DELAYS[key]
  }

  const stepOffsets = computeStepOffsets(effectiveDelays)
  const today = new Date()

  function getPillDate(stepKey: string, stepIdx: number): { text: string; color: string } {
    const base = new Date(campaignCreatedAt)
    const offset = stepOffsets[stepKey] ?? 0
    const scheduled = new Date(base)
    scheduled.setDate(scheduled.getDate() + offset)
    const isToday = scheduled.toDateString() === today.toDateString()

    if (stepIdx < currentIdx) {
      return { text: formatShortDate(scheduled), color: '#9CA3AF' }
    } else if (stepIdx === currentIdx) {
      return { text: isToday ? 'Today' : formatShortDate(scheduled), color: '#E7534F' }
    } else {
      return { text: formatShortDate(scheduled), color: '#9CA3AF' }
    }
  }

  function openDropdown(e: React.MouseEvent) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 4, left: rect.left })
    setDropdownOpen(o => !o)
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', rowGap: '8px' }}>
        {STEP_ORDER.map((stepKey, i) => {
          const isCompleted = i < currentIdx
          const isCurrent = i === currentIdx
          const stepName = STEPS.find(s => s.key === stepKey)?.name ?? stepKey
          const hasCustom = !!(prospect.custom_emails?.[stepKey])
          const pillDate = getPillDate(stepKey, i)
          const gapKey = DELAY_GAP_KEYS[i]
          const isGapCustom = gapKey != null && prospectCustomDelays[gapKey] != null

          return (
            <div key={stepKey} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
              {/* Pill + date stacked */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                {isCurrent ? (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    height: '32px', borderRadius: '20px',
                    backgroundColor: '#E7534F', border: '1px solid #E7534F',
                    overflow: 'hidden', flexShrink: 0,
                  }}>
                    <button
                      onClick={() => onPillClick(prospect, stepKey)}
                      style={{
                        height: '100%', padding: '0 12px 0 14px',
                        backgroundColor: 'transparent', border: 'none',
                        color: '#FFFFFF', fontSize: '13px', fontWeight: '600',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      {stepName}
                      {hasCustom && (
                        <span style={{
                          padding: '1px 5px', borderRadius: '10px',
                          backgroundColor: 'rgba(255,255,255,0.25)',
                          fontSize: '10px', fontWeight: '400',
                        }}>
                          ✎
                        </span>
                      )}
                    </button>
                    <div style={{ width: '1px', height: '60%', backgroundColor: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                    <button
                      onClick={openDropdown}
                      style={{
                        height: '100%', padding: '0 10px',
                        backgroundColor: 'transparent', border: 'none',
                        color: '#FFFFFF', fontSize: '10px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                      }}
                    >
                      ▾
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onPillClick(prospect, stepKey)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      height: '32px', padding: '0 14px', borderRadius: '20px',
                      border: '1px solid #E5E5E5',
                      backgroundColor: isCompleted ? '#FFFFFF' : '#F7F6F3',
                      color: isCompleted ? '#6B7280' : '#9CA3AF',
                      fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {isCompleted && <span style={{ fontSize: '10px' }}>✓</span>}
                    {stepName}
                    {hasCustom && (
                      <span style={{
                        padding: '1px 5px', borderRadius: '10px',
                        backgroundColor: '#F3F3F1', color: '#9CA3AF',
                        fontSize: '10px',
                      }}>
                        ✎
                      </span>
                    )}
                  </button>
                )}
                {/* Date below pill */}
                <span style={{ fontSize: '10px', color: pillDate.color, whiteSpace: 'nowrap' }}>
                  {pillDate.text}
                </span>
              </div>

              {/* Gap connector between pills */}
              {i < STEP_ORDER.length - 1 && (
                <div style={{ marginTop: '8px' }}>
                  <DayGapBox
                    value={effectiveDelays[gapKey] ?? DEFAULT_DELAYS[gapKey] ?? 3}
                    isCustom={isGapCustom}
                    onChange={v => onDelayChange(prospect.id, gapKey, v)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {mounted && dropdownOpen && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setDropdownOpen(false)}
          />
          <div style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            zIndex: 100,
            backgroundColor: '#FFFFFF',
            border: '0.5px solid #E5E5E5',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            minWidth: '160px',
            overflow: 'hidden',
          }}>
            <p style={{
              fontSize: '10px', color: '#9CA3AF', padding: '8px 12px 4px',
              margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600',
            }}>
              Move to step
            </p>
            {STEP_ORDER.map(s => (
              <button
                key={s}
                onClick={() => { onMoveToStep(prospect.id, s); setDropdownOpen(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '9px 14px', fontSize: '14px',
                  color: s === prospect.sequence_step ? '#E7534F' : '#0D0D0D',
                  fontWeight: s === prospect.sequence_step ? '600' : '400',
                  backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F7F6F3')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {STEPS.find(st => st.key === s)?.name ?? s}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  )
}

// ─── EmailModal ───────────────────────────────────────────────────────────────

const toolbarBtnStyle: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid #E5E5E5', borderRadius: '4px',
  backgroundColor: '#FFFFFF', color: '#374151', fontSize: '13px',
  cursor: 'pointer', lineHeight: 1,
}

function EmailModal({
  prospect,
  stepKey,
  campaignCreatedAt,
  campaignDelays,
  onClose,
  onSaved,
}: {
  prospect: Prospect
  stepKey: string
  campaignCreatedAt: string
  campaignDelays: Record<string, number>
  onClose: () => void
  onSaved: (stepKey: string, email: { subject: string; body: string }) => void
}) {
  const step = STEPS.find(s => s.key === stepKey)

  const customEmail = prospect.custom_emails?.[stepKey] ?? null
  const initSubject = customEmail?.subject ?? step?.subject ?? ''
  const initBody = customEmail?.body ?? step?.body ?? ''

  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [editSubject, setEditSubject] = useState(initSubject)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loadTemplateOpen, setLoadTemplateOpen] = useState(false)
  const [confirmTemplate, setConfirmTemplate] = useState<string | null>(null)
  const [localSaved, setLocalSaved] = useState<{ subject: string; body: string } | null>(null)

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
        style: 'min-height: 240px; padding: 1rem; font-size: 14px; line-height: 1.6; outline: none; font-family: inherit;',
      },
    },
  })

  if (!step) return null

  // Compute offsets using prospect's custom delays merged with campaign delays
  const prospectCustomDelays = prospect.custom_delays ?? {}
  const effectiveDelays: Record<string, number> = {}
  for (const key of DELAY_GAP_KEYS) {
    effectiveDelays[key] = prospectCustomDelays[key] ?? campaignDelays[key] ?? DEFAULT_DELAYS[key]
  }
  const stepOffsets = computeStepOffsets(effectiveDelays)

  const stepDepth = STEP_DEPTH[stepKey] ?? 0
  const currentDepth = STEP_DEPTH[prospect.sequence_step] ?? 0
  const isSentStep = stepDepth < currentDepth
  const sentStatus = getSentStatus(stepKey, prospect, campaignCreatedAt, stepOffsets)

  const displayCustom = localSaved ?? customEmail
  const displaySubject = displayCustom?.subject ?? step.subject
  const displayBody = displayCustom?.body ?? null
  const resolvedBody = displayBody
    ? resolveBody(displayBody, prospect)
    : resolveBody(step.body, prospect)

  const statusBadge = prospectStatusBadge(prospect.status)

  function handleCancel() {
    const sub = localSaved?.subject ?? customEmail?.subject ?? step!.subject
    const body = localSaved?.body ?? customEmail?.body ?? step!.body
    setEditSubject(sub)
    editor?.commands.setContent(body)
    setMode('view')
  }

  async function handleSave() {
    if (!editor) return
    setSaving(true)
    try {
      const email = { subject: editSubject, body: editor.getHTML() }
      await saveCustomEmail(prospect.id, stepKey, email)
      setLocalSaved(email)
      onSaved(stepKey, email)
      setMode('view')
    } finally {
      setSaving(false)
    }
  }

  function handleCopy() {
    const bodyText = displayBody ? htmlToText(resolvedBody) : resolvedBody
    navigator.clipboard.writeText(`Subject: ${displaySubject}\n\n${bodyText}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF', borderRadius: '12px',
          width: '100%', maxWidth: '640px',
          maxHeight: '88vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E5E5E5', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '16px', fontWeight: '700', color: '#0D0D0D' }}>
                {step.name}
              </span>
              <span style={{ fontSize: '13px', color: '#9CA3AF', marginLeft: '8px' }}>
                {prospect.full_name ?? ''}
                {prospect.company ? ` · ${prospect.company}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px' }}>
              {isSentStep ? (
                <span style={{
                  padding: '3px 10px', borderRadius: '20px', fontSize: '12px',
                  fontWeight: '500', backgroundColor: '#DBEAFE', color: '#1E40AF',
                  whiteSpace: 'nowrap',
                }}>
                  {sentStatus}
                </span>
              ) : mode === 'view' ? (
                <button
                  onClick={() => setMode('edit')}
                  style={{
                    padding: '5px 12px', border: '1px solid #E5E5E5', borderRadius: '6px',
                    backgroundColor: '#FFFFFF', color: '#374151', fontSize: '13px',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  Edit
                </button>
              ) : null}
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', fontSize: '16px',
                  color: '#9CA3AF', cursor: 'pointer', padding: '2px 4px', lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* View mode */}
        {mode === 'view' && (
          <div style={{ padding: '20px 24px', flex: 1 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              marginBottom: '16px', fontSize: '12px', color: '#9CA3AF',
            }}>
              <span>{sentStatus}</span>
              <span style={{
                padding: '2px 8px', borderRadius: '20px', fontSize: '11px',
                fontWeight: '500', backgroundColor: statusBadge.bg, color: statusBadge.color,
              }}>
                {statusBadge.label}
              </span>
              {displayCustom && (
                <span style={{
                  padding: '2px 8px', borderRadius: '20px', fontSize: '11px',
                  backgroundColor: '#F3F3F1', color: '#6B7280',
                }}>
                  ✎ customised
                </span>
              )}
            </div>

            <div style={{ borderTop: '1px solid #E5E5E5', marginBottom: '16px' }} />

            <p style={{
              fontSize: '11px', fontWeight: '600', color: '#9CA3AF',
              textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px',
            }}>
              Subject
            </p>
            <p style={{ fontSize: '14px', color: '#0D0D0D', marginBottom: '16px' }}>
              {displaySubject}
            </p>

            {displayBody ? (
              <div
                dangerouslySetInnerHTML={{ __html: resolvedBody }}
                style={{
                  fontSize: '13px', lineHeight: 1.8, color: '#0D0D0D',
                  padding: '16px', backgroundColor: '#F7F6F3', borderRadius: '8px',
                  marginBottom: '20px',
                }}
              />
            ) : (
              <pre style={{
                margin: '0 0 20px', padding: '16px', backgroundColor: '#F7F6F3',
                borderRadius: '8px', fontSize: '13px', color: '#0D0D0D',
                lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'inherit',
              }}>
                {resolvedBody}
              </pre>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleCopy}
                style={{
                  padding: '8px 16px', border: '1px solid #E5E5E5', borderRadius: '7px',
                  backgroundColor: copied ? '#DCFCE7' : '#FFFFFF',
                  color: copied ? '#166534' : '#6B7280',
                  fontSize: '13px', cursor: 'pointer',
                }}
              >
                {copied ? '✓ Copied' : 'Copy email'}
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px', border: '1px solid #E5E5E5', borderRadius: '7px',
                  backgroundColor: '#FFFFFF', color: '#6B7280', fontSize: '13px', cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Edit mode */}
        {mode === 'edit' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{
              padding: '12px 24px', borderBottom: '1px solid #F3F3F1',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ fontSize: '12px', color: '#9CA3AF', width: '36px', flexShrink: 0 }}>To:</span>
              <span style={{ fontSize: '13px', color: '#6B7280' }}>{prospect.email ?? '—'}</span>
            </div>

            <div style={{
              padding: '10px 24px', borderBottom: '1px solid #E5E5E5',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ fontSize: '12px', color: '#9CA3AF', width: '52px', flexShrink: 0 }}>Subject:</span>
              <input
                type="text"
                value={editSubject}
                onChange={e => setEditSubject(e.target.value)}
                style={{
                  flex: 1, fontSize: '14px', color: '#0D0D0D',
                  border: 'none', outline: 'none', backgroundColor: 'transparent',
                }}
              />
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap',
              padding: '8px 16px', borderBottom: '1px solid #E5E5E5',
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
              <button
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                style={{ ...toolbarBtnStyle, backgroundColor: editor?.isActive('orderedList') ? '#F3F3F1' : '#FFFFFF' }}
              >1. List</button>
              <select
                onChange={e => {
                  if (e.target.value) {
                    ;(editor?.chain().focus() as any)?.setFontSize(e.target.value + 'px')?.run()
                  }
                }}
                defaultValue=""
                style={{
                  fontSize: '12px', border: '1px solid #E5E5E5', borderRadius: '4px',
                  padding: '4px 6px', cursor: 'pointer', backgroundColor: '#FFFFFF',
                  color: '#374151',
                }}
              >
                <option value="" disabled>Size</option>
                <option value="12">12px</option>
                <option value="14">14px</option>
                <option value="16">16px</option>
                <option value="18">18px</option>
              </select>
            </div>

            <div style={{ flex: 1, borderBottom: '1px solid #E5E5E5' }}>
              <EditorContent editor={editor} />
            </div>

            <div style={{
              padding: '12px 24px', display: 'flex',
              alignItems: 'center', gap: '8px', flexShrink: 0,
              backgroundColor: '#FAFAFA', position: 'relative',
            }}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setLoadTemplateOpen(o => !o)}
                  style={{
                    padding: '7px 12px', border: '1px solid #E5E5E5', borderRadius: '6px',
                    backgroundColor: '#FFFFFF', color: '#6B7280', fontSize: '13px', cursor: 'pointer',
                  }}
                >
                  Load template ▾
                </button>
                {loadTemplateOpen && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                      onClick={() => setLoadTemplateOpen(false)}
                    />
                    <div style={{
                      position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, zIndex: 61,
                      backgroundColor: '#FFFFFF', border: '0.5px solid #E5E5E5',
                      borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      minWidth: '180px', overflow: 'hidden',
                    }}>
                      {STEPS.map(s => (
                        <button
                          key={s.key}
                          onClick={() => { setConfirmTemplate(s.key); setLoadTemplateOpen(false) }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '9px 14px', fontSize: '13px', color: '#0D0D0D',
                            backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F7F6F3')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {confirmTemplate && (
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 8px)', left: '16px',
                  backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: '8px',
                  padding: '14px 16px', zIndex: 62, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  maxWidth: '280px',
                }}>
                  <p style={{ fontSize: '13px', color: '#0D0D0D', margin: '0 0 10px' }}>
                    This will replace your current edits. Continue?
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        const tmpl = STEPS.find(s => s.key === confirmTemplate)
                        if (tmpl) {
                          setEditSubject(tmpl.subject)
                          editor?.commands.setContent(tmpl.body)
                        }
                        setConfirmTemplate(null)
                      }}
                      style={{
                        padding: '5px 12px', border: 'none', borderRadius: '6px',
                        backgroundColor: '#E7534F', color: '#FFFFFF', fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => setConfirmTemplate(null)}
                      style={{
                        padding: '5px 12px', border: '1px solid #E5E5E5', borderRadius: '6px',
                        backgroundColor: '#FFFFFF', color: '#6B7280', fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div style={{ flex: 1 }} />
              <button
                onClick={handleCancel}
                style={{
                  padding: '7px 14px', border: '1px solid #E5E5E5', borderRadius: '6px',
                  backgroundColor: '#FFFFFF', color: '#6B7280', fontSize: '13px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '7px 16px', border: 'none', borderRadius: '6px',
                  backgroundColor: saving ? '#F3A09F' : '#E7534F',
                  color: '#FFFFFF', fontSize: '13px', fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SequenceTab({ prospects, campaign }: Props) {
  const [search, setSearch] = useState('')
  const [stepFilter, setStepFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false)
  const [modal, setModal] = useState<{ prospect: Prospect; stepKey: string } | null>(null)
  const [localOverrides, setLocalOverrides] = useState<Map<string, Partial<Prospect>>>(new Map())
  const [toast, setToast] = useState<string | null>(null)

  // Campaign-level delays as baseline for all prospects
  const campaignDelays: Record<string, number> = {
    ...DEFAULT_DELAYS,
    ...(campaign.sequence_delays ?? {}),
  }

  function getEffective(p: Prospect): Prospect {
    const ov = localOverrides.get(p.id)
    return ov ? { ...p, ...ov } : p
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function applyOverride(id: string, patch: Partial<Prospect>) {
    setLocalOverrides(prev => new Map(prev).set(id, { ...prev.get(id), ...patch }))
  }

  function revertOverride(id: string) {
    setLocalOverrides(prev => { const m = new Map(prev); m.delete(id); return m })
  }

  const active = prospects
    .filter(p => p.sequence_step !== 'not_started')
    .map(p => getEffective(p))

  const q = search.toLowerCase()
  const filtered = sortActive(active).filter(p => {
    if (q && !(
      (p.full_name ?? '').toLowerCase().includes(q) ||
      (p.company ?? '').toLowerCase().includes(q) ||
      (p.email ?? '').toLowerCase().includes(q)
    )) return false
    if (stepFilter === 'all') return true
    if (stepFilter === 'replied') return p.status === 'replied'
    if (stepFilter === 'paused') return p.paused ?? false
    return p.sequence_step === stepFilter
  })

  const allFilteredIds = filtered.map(p => p.id)
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id))

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(prev => { const n = new Set(prev); allFilteredIds.forEach(id => n.delete(id)); return n })
    } else {
      setSelectedIds(prev => new Set([...prev, ...allFilteredIds]))
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function handlePauseToggle(p: Prospect) {
    const newPaused = !(p.paused ?? false)
    applyOverride(p.id, { paused: newPaused })
    try {
      await toggleProspectPaused(p.id, newPaused)
    } catch {
      revertOverride(p.id)
    }
  }

  async function handleMoveToStep(prospectId: string, step: string) {
    applyOverride(prospectId, { sequence_step: step })
    try {
      await moveProspectToStep(prospectId, step)
    } catch {
      revertOverride(prospectId)
    }
  }

  async function handleBulkMove(step: string) {
    const ids = Array.from(selectedIds)
    ids.forEach(id => applyOverride(id, { sequence_step: step }))
    setSelectedIds(new Set())
    setBulkMoveOpen(false)
    try {
      await bulkMoveToStep(ids, step)
      showToast(`Moved ${ids.length} prospect${ids.length !== 1 ? 's' : ''} to ${STEPS.find(s => s.key === step)?.name ?? step}`)
    } catch {
      ids.forEach(id => revertOverride(id))
    }
  }

  async function handleBulkPause() {
    const ids = Array.from(selectedIds)
    ids.forEach(id => applyOverride(id, { paused: true }))
    setSelectedIds(new Set())
    try {
      await bulkPause(ids)
      showToast(`Paused ${ids.length} prospect${ids.length !== 1 ? 's' : ''}`)
    } catch {
      ids.forEach(id => revertOverride(id))
    }
  }

  async function handleDelayChange(prospectId: string, gapKey: string, value: number) {
    const prospect = prospects.find(p => p.id === prospectId)
    if (!prospect) return
    const effective = getEffective(prospect)
    const currentCustomDelays = effective.custom_delays ?? {}
    const newCustomDelays = { ...currentCustomDelays, [gapKey]: value }
    applyOverride(prospectId, { custom_delays: newCustomDelays })
    try {
      await saveProspectCustomDelay(prospectId, gapKey, value, currentCustomDelays)
    } catch {
      revertOverride(prospectId)
    }
  }

  function handleEmailSaved(stepKey: string, email: { subject: string; body: string }) {
    if (!modal) return
    const pid = modal.prospect.id
    const currentCustom = (getEffective(modal.prospect).custom_emails ?? {}) as Record<string, { subject: string; body: string }>
    applyOverride(pid, {
      custom_emails: { ...currentCustom, [stepKey]: email },
    })
    showToast(`Email saved for ${modal.prospect.full_name ?? 'prospect'}`)
  }

  const hasSel = selectedIds.size > 0

  return (
    <div>
      <p style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '16px' }}>
        {active.length} active sequence{active.length !== 1 ? 's' : ''}
      </p>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, company or email…"
          style={{
            flex: '1', minWidth: '220px', padding: '8px 12px',
            border: '1px solid #E5E5E5', borderRadius: '8px',
            fontSize: '13px', color: '#0D0D0D', outline: 'none', backgroundColor: '#FFFFFF',
          }}
        />
        <select
          value={stepFilter}
          onChange={e => setStepFilter(e.target.value)}
          style={{
            padding: '8px 12px', border: '1px solid #E5E5E5', borderRadius: '8px',
            fontSize: '13px', color: '#0D0D0D', backgroundColor: '#FFFFFF',
            cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="all">All Steps</option>
          {STEP_ORDER.map(k => (
            <option key={k} value={k}>{STEPS.find(s => s.key === k)?.name ?? k}</option>
          ))}
          <option value="replied">Replied</option>
          <option value="paused">Paused</option>
        </select>
      </div>

      {/* Bulk action bar */}
      {hasSel && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          backgroundColor: '#0D0D0D', color: '#FFFFFF',
          padding: '10px 16px', borderRadius: '8px', marginBottom: '12px', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '13px', fontWeight: '500' }}>{selectedIds.size} selected</span>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setBulkMoveOpen(o => !o)}
              style={{
                padding: '6px 12px', border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '6px', backgroundColor: 'transparent', color: '#FFFFFF',
                fontSize: '13px', cursor: 'pointer',
              }}
            >
              Move to step ▾
            </button>
            {bulkMoveOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 20 }} onClick={() => setBulkMoveOpen(false)} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 30,
                  backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
                  borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  overflow: 'hidden', minWidth: '160px',
                }}>
                  {STEP_ORDER.map(s => (
                    <button
                      key={s}
                      onClick={() => handleBulkMove(s)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '10px 14px', fontSize: '13px', color: '#0D0D0D',
                        backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F7F6F3')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {STEPS.find(st => st.key === s)?.name ?? s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={handleBulkPause}
            style={{
              padding: '6px 12px', border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '6px', backgroundColor: 'transparent', color: '#FFFFFF',
              fontSize: '13px', cursor: 'pointer',
            }}
          >
            Pause selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{
              padding: '6px 8px', background: 'none', border: 'none',
              color: '#9CA3AF', fontSize: '13px', cursor: 'pointer', marginLeft: 'auto',
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Empty states */}
      {active.length === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
          borderRadius: '10px', padding: '60px 24px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '15px', fontWeight: '600', color: '#0D0D0D', marginBottom: '8px' }}>
            No active sequences yet.
          </p>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>
            Go to the Prospects tab and press &ldquo;Start Sequence&rdquo; to begin.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
          borderRadius: '10px', padding: '40px 24px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>No prospects match this filter.</p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: '10px', overflow: 'visible' }}>
          {/* Table header */}
          <div style={{
            display: 'flex', alignItems: 'center', padding: '10px 16px',
            borderBottom: '1px solid #E5E5E5', backgroundColor: '#FAFAFA',
            borderRadius: '10px 10px 0 0',
          }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              style={{ marginRight: '12px', accentColor: '#E7534F', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Prospect
            </span>
          </div>

          {/* Prospect rows */}
          {filtered.map((p, i) => {
            const isPaused = p.paused ?? false
            const isReplied = p.status === 'replied'
            const isLast = i === filtered.length - 1

            return (
              <div
                key={p.id}
                style={{
                  borderBottom: isLast ? 'none' : '1px solid #F3F3F1',
                  backgroundColor: isReplied ? '#F0FDF4' : isPaused ? '#FFFBEB' : '#FFFFFF',
                  padding: '14px 16px',
                  overflow: 'visible',
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    style={{ marginTop: '2px', flexShrink: 0, accentColor: '#E7534F', cursor: 'pointer' }}
                  />

                  {/* Left column: name / company / email / tags */}
                  <div style={{ width: '220px', flexShrink: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#0D0D0D', lineHeight: 1.3 }}>
                      {p.full_name ?? '—'}
                    </div>
                    {p.company && (
                      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                        {p.company}
                      </div>
                    )}
                    {p.email && (
                      <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '1px' }}>
                        {p.email}
                      </div>
                    )}
                    {p.history_tags && p.history_tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        <HistoryTags tags={p.history_tags} />
                      </div>
                    )}
                  </div>

                  {/* Right column: step pills + pause button */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, overflow: 'visible' }}>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'visible' }}>
                      <StepPills
                        prospect={p}
                        campaignDelays={campaignDelays}
                        onPillClick={(pr, sk) => setModal({ prospect: pr, stepKey: sk })}
                        onMoveToStep={handleMoveToStep}
                        onDelayChange={handleDelayChange}
                        campaignCreatedAt={campaign.created_at}
                      />
                    </div>

                    {/* Status badges + pause button */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <button
                        onClick={() => handlePauseToggle(p)}
                        title={isPaused ? 'Resume' : 'Pause'}
                        style={{
                          padding: '4px 10px', border: '1px solid #E5E5E5', borderRadius: '6px',
                          backgroundColor: '#FFFFFF', color: '#6B7280', fontSize: '13px',
                          cursor: 'pointer', flexShrink: 0,
                        }}
                      >
                        {isPaused ? '▶' : '⏸'}
                      </button>
                      {isReplied && (
                        <span style={{
                          padding: '2px 8px', borderRadius: '20px', fontSize: '11px',
                          fontWeight: '600', backgroundColor: '#DCFCE7', color: '#166534',
                        }}>
                          Replied ✓
                        </span>
                      )}
                      {isPaused && (
                        <span style={{
                          padding: '2px 8px', borderRadius: '20px', fontSize: '11px',
                          fontWeight: '600', backgroundColor: '#FEF3C7', color: '#92400E',
                        }}>
                          Paused
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Email modal */}
      {modal && (
        <EmailModal
          prospect={modal.prospect}
          stepKey={modal.stepKey}
          campaignCreatedAt={campaign.created_at}
          campaignDelays={campaignDelays}
          onClose={() => setModal(null)}
          onSaved={handleEmailSaved}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          backgroundColor: '#0D0D0D', color: '#FFFFFF',
          padding: '12px 20px', borderRadius: '8px',
          fontSize: '14px', zIndex: 200,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
