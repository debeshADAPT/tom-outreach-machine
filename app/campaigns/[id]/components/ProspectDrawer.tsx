'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Prospect, Campaign } from '@/lib/types'
import { STEPS, STEP_ORDER, STEP_DEPTH } from '@/lib/sequence-steps'
import { calculateStepDates, formatDDMMYY } from '@/lib/utils'
import { deleteProspect } from '../actions'

interface Props {
  prospect: Prospect
  campaign: Campaign
  onClose: () => void
  onStageChange: (prospectId: string, step: string) => void
  onOpenEmailPreview: (stepKey: string) => void
  isAdmin: boolean
  currentUserId: string
}

// MOCK DATA — replace with real Graph API reply content when integration is live
const MOCK_REPLIES = [
  "Thanks for reaching out. This looks interesting — can you send me more details on the agenda? I'd love to know more about who else will be attending.",
  "Hi, appreciate the personal invite. This sounds like a genuinely interesting event. I'll need to check my calendar but I'm tentatively interested — can you confirm the date?",
  "Thanks for thinking of me. The format sounds compelling — a small, peer-led room is exactly the kind of thing I find valuable. Count me as interested, pending diary check.",
]

function getMockMatchScore(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0x7fffffff
  const r = h % 100
  if (r < 15) return 45 + (r % 15)
  if (r < 75) return 60 + (r % 26)
  return 86 + (r % 10)
}

function getMockReply(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0x7fffffff
  return MOCK_REPLIES[h % MOCK_REPLIES.length]
}

const ALL_STAGES = [
  { id: 'not_started', label: 'Not Started' },
  { id: 'invite_1',   label: 'Invite 1'    },
  { id: 'followup_1', label: 'Follow-up 1' },
  { id: 'followup_2', label: 'Follow-up 2' },
  { id: 'followup_3', label: 'Follow-up 3' },
  { id: 'final',      label: 'Final'       },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '11px', fontWeight: '600', color: '#9CA3AF',
      textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px',
    }}>
      {children}
    </p>
  )
}

function Divider() {
  return <div style={{ borderTop: '1px solid #E5E5E5', margin: '20px 0' }} />
}

export default function ProspectDrawer({ prospect, campaign, onClose, onStageChange, onOpenEmailPreview, isAdmin, currentUserId }: Props) {
  const [mounted, setMounted]           = useState(false)
  const [visible, setVisible]           = useState(false)
  const [currentStage, setCurrentStage] = useState(prospect.sequence_step)
  const [toast, setToast]               = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]         = useState(false)

  const canAct = isAdmin || prospect.assigned_to === currentUserId

  useEffect(() => {
    setMounted(true)
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    setCurrentStage(prospect.sequence_step)
  }, [prospect.sequence_step])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function changeStage(newStep: string, toastPrefix: string) {
    if (newStep === currentStage) return
    setCurrentStage(newStep)
    onStageChange(prospect.id, newStep)
    const label = ALL_STAGES.find(s => s.id === newStep)?.label ?? newStep
    setToast(`${toastPrefix} ${label}`)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteProspect(prospect.id)
      onClose()
    } catch (err) {
      console.error('Failed to delete prospect:', err)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const score = getMockMatchScore(prospect.id)
  const scoreStyle = score >= 80
    ? { bg: '#F0FDF4', color: '#16A34A' }
    : score >= 60
    ? { bg: '#FFFBEB', color: '#D97706' }
    : { bg: '#FEF2F2', color: '#DC2626' }

  const currentDepth    = STEP_DEPTH[prospect.sequence_step] ?? -1
  const currentStageIdx = ALL_STAGES.findIndex(s => s.id === currentStage)
  const nextStageObj    = currentStage === 'queued'
    ? ALL_STAGES.find(s => s.id === 'invite_1') ?? null
    : currentStageIdx >= 0 && currentStageIdx < ALL_STAGES.length - 1
    ? ALL_STAGES[currentStageIdx + 1]
    : null

  const stepDates = calculateStepDates(prospect, campaign)

  if (!mounted) return null

  const historyTags = prospect.history_tags ?? []

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          backgroundColor: 'rgba(0,0,0,0.2)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 250ms ease',
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '420px', maxWidth: '100vw',
          backgroundColor: '#FFFFFF', zIndex: 301,
          boxShadow: '-4px 0 32px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 250ms ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #E5E5E5', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#0D0D0D', lineHeight: 1.3 }}>
                {prospect.full_name ?? '—'}
              </div>
              <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '3px' }}>
                {[prospect.company, prospect.title].filter(Boolean).join(' · ') || '—'}
              </div>
              <div style={{ marginTop: '8px' }}>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
                  fontSize: '12px', fontWeight: '600',
                  backgroundColor: scoreStyle.bg, color: scoreStyle.color,
                }}>
                  {score}% Match
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              onMouseEnter={e => { e.currentTarget.style.color = '#0D0D0D' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6B7280' }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '22px', color: '#6B7280', lineHeight: 1,
                padding: '2px 4px', flexShrink: 0, marginLeft: '12px',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {historyTags.length > 0 && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {historyTags.map(tag => (
                  <span key={tag} style={{
                    backgroundColor: '#F1EFE8', color: '#5F5E5A',
                    fontSize: '12px', padding: '3px 10px', borderRadius: '20px',
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
              <Divider />
            </>
          )}

          {/* Sequence Progress */}
          <SectionLabel>Sequence Progress</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {STEP_ORDER.map((stepKey, i) => {
              const step       = STEPS.find(s => s.key === stepKey)
              const isSent     = i < currentDepth
              const isCurrent  = i === currentDepth
              const isUpcoming = i > currentDepth

              let indicator      = '—'
              let indicatorColor = '#D1D5DB'
              if (isSent)    { indicator = '✓'; indicatorColor = '#16A34A' }
              if (isCurrent) { indicator = '●'; indicatorColor = '#E7534F' }

              const dateObj = stepDates[stepKey]
              const dateStr = dateObj ? formatDDMMYY(dateObj) : '—'
              const restoreBg = isCurrent ? '#FEF2F2' : 'transparent'

              return (
                <div
                  key={stepKey}
                  onClick={() => onOpenEmailPreview(stepKey)}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F7F6F3' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = restoreBg }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', borderRadius: '6px',
                    backgroundColor: restoreBg,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{
                    fontSize: '13px', color: indicatorColor,
                    flexShrink: 0, width: '16px', textAlign: 'center',
                  }}>
                    {indicator}
                  </span>
                  <div style={{ flex: 1 }}>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: isCurrent ? '600' : '400',
                      color: isUpcoming ? '#9CA3AF' : '#0D0D0D',
                    }}>
                      {step?.name ?? stepKey}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#9CA3AF', flexShrink: 0 }}>
                    {dateStr}
                  </span>
                </div>
              )
            })}
          </div>

          <Divider />

          {/* Current Stage — owner or admin only */}
          <SectionLabel>Current Stage</SectionLabel>
          <select
            value={currentStage}
            onChange={e => canAct && changeStage(e.target.value, 'Stage updated to')}
            onFocus={e => { if (canAct) e.currentTarget.style.borderColor = '#E7534F' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#E5E5E5' }}
            disabled={!canAct}
            style={{
              width: '100%', padding: '10px 12px', fontSize: '14px',
              color: '#0D0D0D', backgroundColor: '#FFFFFF',
              border: '1px solid #E5E5E5', borderRadius: '6px',
              outline: 'none', cursor: canAct ? 'pointer' : 'default',
              opacity: canAct ? 1 : 0.6,
            }}
          >
            {ALL_STAGES.map(stage => (
              <option key={stage.id} value={stage.id}>{stage.label}</option>
            ))}
          </select>

          {/* Trigger Next Step — owner or admin only */}
          {canAct && (
            <button
              onClick={nextStageObj ? () => changeStage(nextStageObj.id, 'Moved to') : undefined}
              disabled={!nextStageObj}
              style={{
                width: '100%', padding: '10px', marginTop: '8px',
                border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600',
                cursor: nextStageObj ? 'pointer' : 'not-allowed',
                backgroundColor: '#E7534F', color: '#FFFFFF',
                opacity: nextStageObj ? 1 : 0.4,
              }}
            >
              {nextStageObj ? 'Trigger Next Step →' : 'Sequence Complete'}
            </button>
          )}

          {/* Delete prospect — owner or admin only */}
          {canAct && (
            <div style={{ marginTop: '12px' }}>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    width: '100%', padding: '8px', border: '1px solid #FCA5A5',
                    borderRadius: '6px', fontSize: '13px', color: '#DC2626',
                    backgroundColor: '#FFFFFF', cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#FEF2F2' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF' }}
                >
                  Delete prospect
                </button>
              ) : (
                <div style={{
                  border: '1px solid #FCA5A5', borderRadius: '6px',
                  padding: '12px', backgroundColor: '#FEF2F2',
                }}>
                  <p style={{ fontSize: '13px', color: '#DC2626', margin: '0 0 10px', fontWeight: '500' }}>
                    Delete this prospect? This cannot be undone.
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      style={{
                        flex: 1, padding: '7px', border: 'none', borderRadius: '5px',
                        backgroundColor: '#DC2626', color: '#FFFFFF',
                        fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                        opacity: deleting ? 0.6 : 1,
                      }}
                    >
                      {deleting ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      style={{
                        flex: 1, padding: '7px', border: '1px solid #FCA5A5',
                        borderRadius: '5px', backgroundColor: '#FFFFFF',
                        color: '#DC2626', fontSize: '13px', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <Divider />

          {/* Reply */}
          <SectionLabel>Reply</SectionLabel>
          {prospect.status === 'replied' ? (
            <>
              {/* MOCK DATA — replace with real Graph API reply content when integration is live */}
              <div style={{
                backgroundColor: '#F7F6F3', border: '1px solid #E5E5E5',
                borderRadius: '8px', padding: '12px 14px',
                fontSize: '13px', color: '#0D0D0D', lineHeight: 1.7,
                marginBottom: '8px',
              }}>
                {getMockReply(prospect.id)}
              </div>
              <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>
                {prospect.full_name ?? 'Prospect'} · replied recently
              </p>
            </>
          ) : (
            <p style={{ fontSize: '13px', color: '#9CA3AF', fontStyle: 'italic', margin: 0 }}>
              No reply received yet
            </p>
          )}

        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'absolute', bottom: '20px', left: '16px', right: '16px',
            backgroundColor: '#0D0D0D', color: '#FFFFFF',
            padding: '10px 16px', borderRadius: '8px',
            fontSize: '13px', textAlign: 'center', zIndex: 1,
          }}>
            ✓ {toast}
          </div>
        )}
      </div>
    </>,
    document.body
  )
}
