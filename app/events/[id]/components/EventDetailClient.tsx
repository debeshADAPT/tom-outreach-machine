'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import type { Event, EventChangelogEntry, EventBrief } from '../../actions'
import {
  resyncEventBrief,
  updateEvent,
  assignRepToEvent,
  unassignRepFromEvent,
} from '../../actions'

// ─── Primitives ───────────────────────────────────────────────────────────────

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      border: '2px solid #E5E5E5', borderTopColor: '#9CA3AF',
      animation: 'spin 0.75s linear infinite', flexShrink: 0,
    }} />
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: '700', color: '#9CA3AF',
      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px',
    }}>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.55' }}>
        {value || <span style={{ color: '#D1D5DB' }}>—</span>}
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  backgroundColor: '#FFFFFF', border: '1px solid #E4E4E4', borderRadius: '2px',
  padding: '20px 24px', marginBottom: '16px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #E4E4E4',
  borderRadius: '2px', fontSize: '13px', color: '#0D0D0D',
  backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none',
}

// ─── Brief display ────────────────────────────────────────────────────────────

function BriefDisplay({ brief }: { brief: EventBrief }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Field label="Event Overview" value={brief.event_overview} />
      <Field label="Target Audience" value={brief.target_audience} />
      <Field label="Format & Structure" value={brief.format_and_structure} />
      <Field label="Why Attend" value={brief.why_attend} />

      {brief.key_themes?.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Key Themes
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {brief.key_themes.map((t, i) => (
              <span key={i} style={{
                fontSize: '12px', color: '#374151', backgroundColor: '#F3F4F6',
                padding: '3px 10px', borderRadius: '4px',
              }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {brief.agenda_highlights?.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Agenda Highlights
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {brief.agenda_highlights.map((h, i) => (
              <li key={i} style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {brief.speakers?.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Speakers
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {brief.speakers.map((s, i) => (
              <div key={i} style={{
                border: '1px solid #E4E4E4', borderRadius: '2px', padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: '4px',
              }}>
                {s.photo_url && (
                  <img
                    src={s.photo_url} alt={s.name}
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', marginBottom: '4px' }}
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                )}
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0D0D0D' }}>{s.name}</div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>{s.title}{s.company ? `, ${s.company}` : ''}</div>
                {s.topic && <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{s.topic}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Assign Reps modal ────────────────────────────────────────────────────────

interface StaffProfile { id: string; display_name: string | null }

function AssignRepsModal({ event, onClose, onChanged, onRepRemoved }: {
  event: Event
  onClose: () => void
  onChanged: () => void
  onRepRemoved: (userId: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowser()
      const [{ data: profiles }, { data: assignments }] = await Promise.all([
        supabase.from('profiles').select('id, display_name').eq('role', 'staff'),
        supabase.from('campaign_assignments').select('user_id').eq('event_id', event.id),
      ])
      setStaff((profiles ?? []) as StaffProfile[])
      setAssignedIds(new Set((assignments ?? []).map((a: { user_id: string }) => a.user_id)))
      setLoading(false)
    }
    load()
  }, [event.id])

  async function toggle(userId: string) {
    if (pending.has(userId)) return
    setPending(prev => new Set(prev).add(userId))
    const wasAssigned = assignedIds.has(userId)
    setAssignedIds(prev => {
      const next = new Set(prev)
      wasAssigned ? next.delete(userId) : next.add(userId)
      return next
    })
    try {
      if (wasAssigned) {
        await unassignRepFromEvent(event.id, userId)
        onRepRemoved(userId)
      } else {
        await assignRepToEvent(event.id, userId)
      }
      onChanged()
    } catch {
      setAssignedIds(prev => {
        const next = new Set(prev)
        wasAssigned ? next.add(userId) : next.delete(userId)
        return next
      })
    } finally {
      setPending(prev => { const n = new Set(prev); n.delete(userId); return n })
    }
  }

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 400, backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#FFFFFF', borderRadius: '4px',
          width: '100%', maxWidth: '440px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
          zIndex: 401, overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #E4E4E4',
        }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0D0D0D', margin: 0 }}>Assign Reps</h2>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '2px 0 0' }}>
              Toggle a rep ON to auto-create their campaign for this event.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9CA3AF', lineHeight: 1, padding: '4px' }}>
            ×
          </button>
        </div>

        <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
              <Spinner size={24} />
            </div>
          ) : staff.length === 0 ? (
            <p style={{ padding: '24px', textAlign: 'center', fontSize: '14px', color: '#9CA3AF' }}>
              No staff members found.
            </p>
          ) : (
            staff.map(p => {
              const isAssigned = assignedIds.has(p.id)
              const isPending = pending.has(p.id)
              const initials = (p.display_name ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
              return (
                <div
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 24px', cursor: 'pointer',
                    opacity: isPending ? 0.6 : 1, transition: 'background-color 100ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F7F6F3' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    backgroundColor: '#E7534F', color: '#FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: '600', flexShrink: 0,
                  }}>
                    {initials}
                  </div>
                  <span style={{ flex: 1, fontSize: '14px', color: '#0D0D0D', fontWeight: '500' }}>
                    {p.display_name ?? '(no name)'}
                  </span>
                  <div style={{
                    width: 20, height: 20, borderRadius: '4px',
                    border: `2px solid ${isAssigned ? '#E7534F' : '#D1D5DB'}`,
                    backgroundColor: isAssigned ? '#E7534F' : '#FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 150ms',
                  }}>
                    {isAssigned && (
                      <svg viewBox="0 0 12 12" fill="none" width="11" height="11">
                        <path d="M2 6l3 3 5-5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #E4E4E4', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', border: 'none', borderRadius: '2px',
              backgroundColor: '#0D0D0D', color: '#FFFFFF',
              fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Changelog entry ──────────────────────────────────────────────────────────

const CHANGE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  created:       { label: 'Created',       color: '#374151', bg: '#F3F4F6' },
  brief_synced:  { label: 'Brief Synced',  color: '#1D4ED8', bg: '#EFF6FF' },
  rep_assigned:  { label: 'Rep Assigned',  color: '#15803D', bg: '#F0FDF4' },
  rep_unassigned:{ label: 'Rep Unassigned',color: '#B45309', bg: '#FFFBEB' },
}

function ChangelogRow({ entry }: { entry: EventChangelogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const meta = CHANGE_LABELS[entry.change_type ?? ''] ?? { label: entry.change_type ?? '—', color: '#374151', bg: '#F3F4F6' }
  const hasPrevBrief = entry.change_type === 'brief_synced' && !!entry.detail?.previous_brief

  const dateStr = new Date(entry.changed_at).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={{ paddingBottom: '14px', borderBottom: '1px solid #F3F3F1', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '11px', fontWeight: '600', color: meta.color,
          backgroundColor: meta.bg, padding: '2px 8px', borderRadius: '2px', whiteSpace: 'nowrap',
        }}>
          {meta.label}
        </span>
        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
          {(entry.profiles as { display_name: string | null } | null)?.display_name ?? 'System'} · {dateStr}
        </span>
        {hasPrevBrief && (
          <button
            onClick={() => setExpanded(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6B7280', padding: 0 }}
          >
            {expanded ? '▲ Hide previous brief' : '▼ View previous brief'}
          </button>
        )}
      </div>
      {expanded && hasPrevBrief && (
        <pre style={{
          marginTop: '10px', padding: '12px', backgroundColor: '#F9F9F8',
          borderRadius: '2px', fontSize: '11px', color: '#374151',
          overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {JSON.stringify(entry.detail!.previous_brief, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function EventDetailClient({ event: initialEvent, changelog: initialChangelog, isAdmin }: {
  event: Event
  changelog: EventChangelogEntry[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [resyncing, setResyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showRepsModal, setShowRepsModal] = useState(false)

  // Optimistic exclusion set — user_ids removed locally before server confirms.
  // We filter the live server prop rather than copying it to state, so router.refresh()
  // can never restore a rep we just removed.
  const [removedRepIds, setRemovedRepIds] = useState<Set<string>>(new Set())
  const assignedReps = (initialEvent.assignedReps ?? []).filter(r => !removedRepIds.has(r.user_id))

  // Editable info fields (admin only)
  const [sfId, setSfId]           = useState(initialEvent.sf_identifier)
  const [date, setDate]           = useState(initialEvent.date)
  const [location, setLocation]   = useState(initialEvent.location)
  const [urlMain, setUrlMain]     = useState(initialEvent.url_main ?? '')
  const [urlSpeakers, setUrlSpeakers] = useState(initialEvent.url_speakers ?? '')
  const [urlAgenda, setUrlAgenda] = useState(initialEvent.url_agenda ?? '')

  // Poll for brief completion when pending
  useEffect(() => {
    if (initialEvent.brief_status !== 'pending') return
    const interval = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(interval)
  }, [initialEvent.brief_status, router])

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const result = await updateEvent(initialEvent.id, {
      sf_identifier: sfId,
      date,
      location,
      url_main:      urlMain || null,
      url_speakers:  urlSpeakers || null,
      url_agenda:    urlAgenda || null,
    })
    setSaving(false)
    if (!result.ok) setSaveError(result.error ?? 'Save failed')
    else router.refresh()
  }

  async function handleResync() {
    setResyncing(true)
    await resyncEventBrief(initialEvent.id)
    setResyncing(false)
    router.refresh()
  }

  const isEdge = initialEvent.event_type === 'EDGE'

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ minHeight: '100vh', backgroundColor: '#F8F8F8' }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#FFFFFF', borderBottom: '1px solid #E4E4E4',
          padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '14px',
        }}>
          <Link href="/events" style={{ fontSize: '13px', color: '#9CA3AF', textDecoration: 'none' }}>
            ← Events Hub
          </Link>
          <span style={{ color: '#E5E5E5' }}>|</span>
          <h1 style={{ fontSize: '16px', fontWeight: '700', color: '#0D0D0D', margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {initialEvent.sf_identifier}
          </h1>
          <span style={{
            fontSize: '11px', fontWeight: '600', color: '#6B7280',
            backgroundColor: '#F3F4F6', padding: '3px 10px', borderRadius: '2px',
          }}>
            {initialEvent.event_type}
          </span>
        </div>

        <div style={{ padding: '28px 32px', maxWidth: '900px' }}>

          {/* ── Event Info ─────────────────────────────────────────────── */}
          <div style={card}>
            <SectionHeader>Event Info</SectionHeader>

            {isAdmin ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>
                      SF Identifier
                    </label>
                    <input
                      value={sfId} onChange={e => setSfId(e.target.value)}
                      style={inputStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = '#E7534F')}
                      onBlur={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>
                      Date
                    </label>
                    <input
                      type="date" value={date} onChange={e => setDate(e.target.value)}
                      style={inputStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = '#E7534F')}
                      onBlur={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>
                    Location
                  </label>
                  <input
                    value={location} onChange={e => setLocation(e.target.value)}
                    style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#E7534F')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>
                    Main Event URL
                  </label>
                  <input
                    type="url" value={urlMain} onChange={e => setUrlMain(e.target.value)}
                    placeholder="https://…" style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#E7534F')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
                  />
                </div>
                {isEdge && (
                  <>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>
                        Speakers URL
                      </label>
                      <input
                        type="url" value={urlSpeakers} onChange={e => setUrlSpeakers(e.target.value)}
                        placeholder="https://…" style={inputStyle}
                        onFocus={e => (e.currentTarget.style.borderColor = '#E7534F')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>
                        Agenda URL
                      </label>
                      <input
                        type="url" value={urlAgenda} onChange={e => setUrlAgenda(e.target.value)}
                        placeholder="https://…" style={inputStyle}
                        onFocus={e => (e.currentTarget.style.borderColor = '#E7534F')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
                      />
                    </div>
                  </>
                )}

                {saveError && <p style={{ fontSize: '12px', color: '#DC2626', margin: 0 }}>{saveError}</p>}

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={handleSave} disabled={saving}
                    style={{
                      padding: '7px 18px', border: 'none', borderRadius: '2px',
                      backgroundColor: saving ? '#F3F4F6' : '#0D0D0D',
                      color: saving ? '#9CA3AF' : '#FFFFFF',
                      fontSize: '13px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button
                    onClick={handleResync}
                    disabled={resyncing || !(urlMain || urlSpeakers || urlAgenda || initialEvent.url_main)}
                    title="Re-scrape all URLs and regenerate brief"
                    style={{
                      padding: '7px 18px', border: '1px solid #E4E4E4', borderRadius: '2px',
                      backgroundColor: '#FFFFFF', color: '#374151',
                      fontSize: '13px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      opacity: resyncing ? 0.6 : 1,
                    }}
                    onMouseEnter={e => { if (!resyncing) e.currentTarget.style.borderColor = '#E7534F' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E5E5' }}
                  >
                    {resyncing ? <><Spinner size={12} /> Syncing…</> : 'Resync Brief'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                <Field label="SF Identifier" value={initialEvent.sf_identifier} />
                <Field label="Date" value={
                  initialEvent.date
                    ? new Date(initialEvent.date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
                    : null
                } />
                <Field label="Location" value={initialEvent.location} />
                <Field label="Type" value={initialEvent.event_type} />
              </div>
            )}
          </div>

          {/* ── Brief ──────────────────────────────────────────────────── */}
          <div style={card}>
            <SectionHeader>Event Brief</SectionHeader>

            {!initialEvent.brief_status && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF', fontSize: '14px' }}>
                No brief yet — add URLs above and click Resync Brief.
              </div>
            )}

            {initialEvent.brief_status === 'pending' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', color: '#6B7280', fontSize: '13px' }}>
                <Spinner size={18} />
                Scraping URLs and generating brief — this may take 30–60 seconds…
              </div>
            )}

            {initialEvent.brief_status === 'failed' && (
              <div style={{ padding: '8px 0' }}>
                <p style={{ fontSize: '14px', color: '#DC2626', margin: '0 0 12px 0' }}>
                  Brief sync failed. Previous brief (if any) was preserved.
                </p>
                {isAdmin && (
                  <button
                    onClick={handleResync} disabled={resyncing}
                    style={{
                      padding: '7px 16px', border: 'none', borderRadius: '2px',
                      backgroundColor: '#E7534F', color: '#FFFFFF',
                      fontSize: '13px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    {resyncing ? <><Spinner size={12} /> Syncing…</> : 'Retry Sync'}
                  </button>
                )}
              </div>
            )}

            {initialEvent.brief_status === 'complete' && initialEvent.brief && (
              <>
                {initialEvent.brief_updated_at && (
                  <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '0 0 16px 0' }}>
                    Last synced {new Date(initialEvent.brief_updated_at).toLocaleString('en-AU', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}
                <BriefDisplay brief={initialEvent.brief} />
              </>
            )}
          </div>

          {/* ── Assigned Reps ───────────────────────────────────────────── */}
          {isAdmin && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <SectionHeader>Assigned Reps</SectionHeader>
                <button
                  onClick={() => setShowRepsModal(true)}
                  style={{
                    padding: '5px 14px', border: '1px solid #E4E4E4', borderRadius: '2px',
                    backgroundColor: '#FFFFFF', color: '#374151', fontSize: '12px',
                    cursor: 'pointer', fontWeight: '500',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#E7534F')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
                >
                  Manage Reps
                </button>
              </div>

              {assignedReps.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
                  No reps assigned yet. Click Manage Reps to assign staff.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {assignedReps.map(r => {
                    const initials = (r.display_name ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                    return (
                      <div key={r.user_id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          backgroundColor: '#E7534F', color: '#FFFFFF',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px', fontWeight: '600', flexShrink: 0,
                        }}>
                          {initials}
                        </div>
                        <span style={{ fontSize: '13px', color: '#0D0D0D', fontWeight: '500', flex: 1 }}>
                          {r.display_name ?? '(no name)'}
                        </span>
                        {r.campaign_id && (
                          <Link
                            href={`/campaigns/${r.campaign_id}`}
                            style={{ fontSize: '12px', color: '#E7534F', textDecoration: 'none' }}
                          >
                            View Campaign →
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Changelog ───────────────────────────────────────────────── */}
          <div style={card}>
            <SectionHeader>Changelog</SectionHeader>

            {initialChangelog.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>No history yet.</p>
            ) : (
              <div>
                {initialChangelog.map(entry => (
                  <ChangelogRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {showRepsModal && (
        <AssignRepsModal
          event={initialEvent}
          onClose={() => setShowRepsModal(false)}
          onChanged={() => router.refresh()}
          onRepRemoved={(userId) => setRemovedRepIds(prev => new Set(prev).add(userId))}
        />
      )}
    </>
  )
}
