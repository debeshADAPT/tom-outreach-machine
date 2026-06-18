'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { assignRep, unassignRep } from '../actions'

interface Profile {
  id: string
  display_name: string | null
  role: string
}

interface Props {
  campaignId: string
  onClose: () => void
}

export default function AssignRepsModal({ campaignId, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [staffProfiles, setStaffProfiles] = useState<Profile[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Set<string>>(new Set())

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowser()
      const [{ data: profiles }, { data: assignments }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, role').eq('role', 'staff'),
        supabase.from('campaign_assignments').select('user_id').eq('campaign_id', campaignId),
      ])
      setStaffProfiles((profiles ?? []) as Profile[])
      setAssignedIds(new Set((assignments ?? []).map((a: { user_id: string }) => a.user_id)))
      setLoading(false)
    }
    load()
  }, [campaignId])

  async function toggle(userId: string) {
    if (pending.has(userId)) return
    setPending(prev => new Set(prev).add(userId))
    const wasAssigned = assignedIds.has(userId)
    // Optimistic update
    setAssignedIds(prev => {
      const next = new Set(prev)
      wasAssigned ? next.delete(userId) : next.add(userId)
      return next
    })
    try {
      if (wasAssigned) {
        await unassignRep(campaignId, userId)
      } else {
        await assignRep(campaignId, userId)
      }
    } catch {
      // Revert on error
      setAssignedIds(prev => {
        const next = new Set(prev)
        wasAssigned ? next.add(userId) : next.delete(userId)
        return next
      })
    } finally {
      setPending(prev => { const n = new Set(prev); n.delete(userId); return n })
    }
  }

  if (!mounted) return null

  return createPortal(
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
          width: '100%', maxWidth: '440px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
          zIndex: 401, overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #E5E5E5',
        }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0D0D0D', margin: 0 }}>
              Assign Reps
            </h2>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '2px 0 0' }}>
              Toggle which staff members can work on this campaign
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '22px', color: '#9CA3AF', lineHeight: 1, padding: '4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '8px 0', maxHeight: '400px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '3px solid #E5E5E5', borderTopColor: '#E7534F', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
            </div>
          ) : staffProfiles.length === 0 ? (
            <p style={{ padding: '24px', textAlign: 'center', fontSize: '14px', color: '#9CA3AF' }}>
              No staff members found. Users get a staff role on signup.
            </p>
          ) : (
            staffProfiles.map(profile => {
              const isAssigned = assignedIds.has(profile.id)
              const isPending = pending.has(profile.id)
              const initials = (profile.display_name ?? '?')
                .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

              return (
                <div
                  key={profile.id}
                  onClick={() => toggle(profile.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 24px', cursor: 'pointer',
                    backgroundColor: 'transparent',
                    opacity: isPending ? 0.6 : 1,
                    transition: 'background-color 100ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F7F6F3' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    backgroundColor: '#E7534F', color: '#FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: '600', flexShrink: 0,
                  }}>
                    {initials}
                  </div>
                  <span style={{ flex: 1, fontSize: '14px', color: '#0D0D0D', fontWeight: '500' }}>
                    {profile.display_name ?? '(no name)'}
                  </span>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '4px',
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

        <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E5E5', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', border: 'none', borderRadius: '7px',
              backgroundColor: '#0D0D0D', color: '#FFFFFF',
              fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>,
    document.body
  )
}
