'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Event } from '../actions'
import { createEvent, resyncEventBrief } from '../actions'

// ─── Shared primitives ────────────────────────────────────────────────────────

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      border: '2px solid #E5E5E5', borderTopColor: '#9CA3AF',
      animation: 'spin 0.75s linear infinite', flexShrink: 0,
    }} />
  )
}

function BriefBadge({ status }: { status: Event['brief_status'] }) {
  if (!status) {
    return (
      <span style={{ fontSize: '11px', color: '#9CA3AF', backgroundColor: '#F3F4F6', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
        No Brief
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#3B82F6', whiteSpace: 'nowrap' }}>
        <Spinner size={9} /> Syncing…
      </span>
    )
  }
  if (status === 'complete') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#16A34A', whiteSpace: 'nowrap' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#16A34A', display: 'inline-block', flexShrink: 0 }} />
        Brief Ready
      </span>
    )
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#DC2626', whiteSpace: 'nowrap' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#DC2626', display: 'inline-block', flexShrink: 0 }} />
      Sync Failed
    </span>
  )
}

function RepAvatars({ reps }: { reps: NonNullable<Event['assignedReps']> }) {
  if (!reps.length) {
    return <span style={{ fontSize: '11px', color: '#9CA3AF' }}>No reps</span>
  }
  const visible = reps.slice(0, 3)
  const overflow = reps.length - visible.length
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((r, i) => {
        const initials = (r.display_name ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        return (
          <div key={r.user_id} style={{
            width: 26, height: 26, borderRadius: '50%',
            backgroundColor: '#E7534F', color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: '600',
            border: '2px solid #FFFFFF', marginLeft: i === 0 ? 0 : -8, flexShrink: 0,
          }}>
            {initials}
          </div>
        )
      })}
      {overflow > 0 && (
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          backgroundColor: '#E5E5E5', color: '#6B7280',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', fontWeight: '600',
          border: '2px solid #FFFFFF', marginLeft: -8, flexShrink: 0,
        }}>
          +{overflow}
        </div>
      )}
    </div>
  )
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event, isAdmin, resyncing, onResync }: {
  event: Event
  isAdmin: boolean
  resyncing: boolean
  onResync: (id: string) => void
}) {
  const dateStr = event.date
    ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'
  const hasUrls = event.url_main || event.url_speakers || event.url_agenda

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: '10px',
        padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px',
        transition: 'border-color 150ms',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#D1D5DB')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <Link
          href={`/events/${event.id}`}
          style={{ fontSize: '14px', fontWeight: '700', color: '#0D0D0D', textDecoration: 'none', lineHeight: '1.35', flex: 1, minWidth: 0 }}
        >
          {event.sf_identifier}
        </Link>
        <BriefBadge status={event.brief_status} />
      </div>

      <div style={{ fontSize: '12px', color: '#6B7280' }}>
        {dateStr} · {event.location}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <RepAvatars reps={event.assignedReps ?? []} />
        {isAdmin && (
          <button
            onClick={() => onResync(event.id)}
            disabled={resyncing || !hasUrls}
            title={!hasUrls ? 'No URLs configured' : 'Re-scrape URLs and regenerate brief'}
            style={{
              padding: '4px 10px', border: '1px solid #E5E5E5', borderRadius: '6px',
              backgroundColor: '#FFFFFF', color: '#374151', fontSize: '11px',
              cursor: (resyncing || !hasUrls) ? 'not-allowed' : 'pointer',
              opacity: (resyncing || !hasUrls) ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
            }}
            onMouseEnter={e => { if (!resyncing && hasUrls) e.currentTarget.style.borderColor = '#E7534F' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E5E5' }}
          >
            {resyncing ? <><Spinner size={10} /> Syncing…</> : 'Resync Brief'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function EventSection({ title, events, isAdmin, resyncingIds, onResync }: {
  title: string
  events: Event[]
  isAdmin: boolean
  resyncingIds: Set<string>
  onResync: (id: string) => void
}) {
  return (
    <div>
      <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#0D0D0D', margin: '0 0 14px 0' }}>
        {title}
      </h2>
      {events.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>No {title.toLowerCase()} yet.</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '12px',
        }}>
          {events.map(e => (
            <EventCard
              key={e.id}
              event={e}
              isAdmin={isAdmin}
              resyncing={resyncingIds.has(e.id)}
              onResync={onResync}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Create Event modal ───────────────────────────────────────────────────────

function CreateEventModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: () => void
}) {
  const [eventType, setEventType] = useState<'EDGE' | 'Roundtable'>('EDGE')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    formData.set('event_type', eventType)
    const result = await createEvent(formData)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error ?? 'Failed to create event')
    } else {
      onCreate()
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '1px solid #E5E5E5',
    borderRadius: '7px', fontSize: '13px', color: '#0D0D0D',
    backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '5px',
  }
  const fieldGap: React.CSSProperties = { display: 'flex', flexDirection: 'column' }

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
          backgroundColor: '#FFFFFF', borderRadius: '12px',
          width: '100%', maxWidth: '480px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
          zIndex: 401, maxHeight: '92vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #E5E5E5',
          position: 'sticky', top: 0, backgroundColor: '#FFFFFF', zIndex: 1,
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0D0D0D', margin: 0 }}>Create Event</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9CA3AF', lineHeight: 1, padding: '4px' }}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Type toggle */}
          <div style={fieldGap}>
            <label style={labelStyle}>Event Type</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['EDGE', 'Roundtable'] as const).map(t => (
                <button
                  key={t} type="button" onClick={() => setEventType(t)}
                  style={{
                    padding: '7px 20px', borderRadius: '7px', fontSize: '13px', fontWeight: '500',
                    cursor: 'pointer', border: 'none',
                    backgroundColor: eventType === t ? '#E7534F' : '#F3F4F6',
                    color: eventType === t ? '#FFFFFF' : '#374151',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* SF Identifier */}
          <div style={fieldGap}>
            <label style={labelStyle}>SF Identifier <span style={{ color: '#E7534F' }}>*</span></label>
            <input
              name="sf_identifier" required placeholder="e.g. PRT ServiceNow 30 Sep 26"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#E7534F')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
            />
          </div>

          {/* Date */}
          <div style={fieldGap}>
            <label style={labelStyle}>Date <span style={{ color: '#E7534F' }}>*</span></label>
            <input
              name="date" type="date" required style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#E7534F')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
            />
          </div>

          {/* Location */}
          <div style={fieldGap}>
            <label style={labelStyle}>Location <span style={{ color: '#E7534F' }}>*</span></label>
            <input
              name="location" required placeholder="e.g. Sydney CBD"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#E7534F')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
            />
          </div>

          {/* URLs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <label style={labelStyle}>
                URLs{' '}
                <span style={{ fontSize: '11px', fontWeight: '400', color: '#9CA3AF' }}>— optional, brief can be synced later</span>
              </label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#9CA3AF', display: 'block', marginBottom: '3px' }}>Main Event</label>
                <input
                  name="url_main" type="url" placeholder="https://…"
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#E7534F')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
                />
              </div>
              {eventType === 'EDGE' && (
                <>
                  <div>
                    <label style={{ fontSize: '11px', color: '#9CA3AF', display: 'block', marginBottom: '3px' }}>Speakers</label>
                    <input
                      name="url_speakers" type="url" placeholder="https://…"
                      style={inputStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = '#E7534F')}
                      onBlur={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#9CA3AF', display: 'block', marginBottom: '3px' }}>Agenda</label>
                    <input
                      name="url_agenda" type="url" placeholder="https://…"
                      style={inputStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = '#E7534F')}
                      onBlur={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {error && <p style={{ fontSize: '12px', color: '#DC2626', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button
              type="submit" disabled={submitting}
              style={{
                flex: 1, padding: '9px 0', border: 'none', borderRadius: '8px',
                backgroundColor: submitting ? '#F3F4F6' : '#E7534F',
                color: submitting ? '#9CA3AF' : '#FFFFFF',
                fontSize: '14px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Creating…' : 'Create Event'}
            </button>
            <button
              type="button" onClick={onClose}
              style={{
                padding: '9px 16px', border: '1px solid #E5E5E5', borderRadius: '8px',
                backgroundColor: '#FFFFFF', color: '#374151', fontSize: '14px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function EventsClient({ events: initialEvents, isAdmin }: {
  events: Event[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [resyncingIds, setResyncingIds] = useState<Set<string>>(new Set())

  const edgeEvents = initialEvents.filter(e => e.event_type === 'EDGE')
  const roundtableEvents = initialEvents.filter(e => e.event_type === 'Roundtable')

  async function handleResync(eventId: string) {
    setResyncingIds(prev => new Set(prev).add(eventId))
    await resyncEventBrief(eventId)
    setResyncingIds(prev => { const s = new Set(prev); s.delete(eventId); return s })
    router.refresh()
  }

  function handleCreated() {
    setShowCreate(false)
    router.refresh()
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ minHeight: '100vh', backgroundColor: '#F7F6F3' }}>
        <div style={{
          backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E5E5',
          padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#0D0D0D', margin: 0 }}>Events Hub</h1>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0 0' }}>
              Manage ADAPT events and auto-assign reps to campaigns.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: '8px 18px', border: 'none', borderRadius: '8px',
                backgroundColor: '#E7534F', color: '#FFFFFF',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              }}
            >
              + Create Event
            </button>
          )}
        </div>

        <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '36px' }}>
          <EventSection
            title="EDGE Events"
            events={edgeEvents}
            isAdmin={isAdmin}
            resyncingIds={resyncingIds}
            onResync={handleResync}
          />
          <EventSection
            title="Roundtables"
            events={roundtableEvents}
            isAdmin={isAdmin}
            resyncingIds={resyncingIds}
            onResync={handleResync}
          />
        </div>
      </div>

      {showCreate && (
        <CreateEventModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />
      )}
    </>
  )
}
