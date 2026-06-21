'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UserRecord } from '../actions'
import { inviteUser, revokeUser, updateDisplayName } from '../actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return (parts.length === 1 ? parts[0][0] : parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'staff'>('staff')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await inviteUser(fullName.trim(), email.trim(), role)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error ?? 'Invite failed')
    } else {
      onInvited()
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '1px solid #E4E4E4',
    borderRadius: '2px', fontSize: '13px', color: '#0D0D0D',
    backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '5px',
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
          border: '1px solid #E4E4E4', zIndex: 401,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #E4E4E4',
        }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0D0D0D', margin: 0 }}>Invite User</h2>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '2px 0 0' }}>
              An email invitation will be sent automatically.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9CA3AF', lineHeight: 1, padding: '4px' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Full Name <span style={{ color: '#E7534F' }}>*</span></label>
            <input
              required value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Jane Smith" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#E7534F')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
            />
          </div>

          <div>
            <label style={labelStyle}>Email Address <span style={{ color: '#E7534F' }}>*</span></label>
            <input
              required type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="jane@adapt.com.au" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#E7534F')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
            />
          </div>

          <div>
            <label style={labelStyle}>Role <span style={{ color: '#E7534F' }}>*</span></label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['staff', 'admin'] as const).map(r => (
                <button
                  key={r} type="button" onClick={() => setRole(r)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: '2px', fontSize: '13px', fontWeight: '500',
                    cursor: 'pointer', border: 'none',
                    backgroundColor: role === r ? '#E7534F' : '#F3F4F6',
                    color: role === r ? '#FFFFFF' : '#374151',
                    textTransform: 'capitalize',
                  }}
                >
                  {r === 'staff' ? 'Staff' : 'Admin'}
                </button>
              ))}
            </div>
          </div>

          {error && <p style={{ fontSize: '12px', color: '#DC2626', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button
              type="submit" disabled={submitting}
              style={{
                flex: 1, padding: '9px 0', border: 'none', borderRadius: '2px',
                backgroundColor: submitting ? '#F3F4F6' : '#E7534F',
                color: submitting ? '#9CA3AF' : '#FFFFFF',
                fontSize: '14px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Sending invite…' : 'Send Invite'}
            </button>
            <button
              type="button" onClick={onClose}
              style={{
                padding: '9px 16px', border: '1px solid #E4E4E4', borderRadius: '2px',
                backgroundColor: '#FFFFFF', color: '#374151', fontSize: '14px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ─── Revoke Confirmation ──────────────────────────────────────────────────────

function RevokeModal({ user, onClose, onRevoked }: {
  user: UserRecord
  onClose: () => void
  onRevoked: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRevoke() {
    setLoading(true)
    setError(null)
    const result = await revokeUser(user.id)
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? 'Failed to revoke access')
    } else {
      onRevoked()
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
          width: '100%', maxWidth: '400px',
          border: '1px solid #E4E4E4', zIndex: 401,
          padding: '28px 28px 24px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0D0D0D', margin: '0 0 8px' }}>
          Revoke access?
        </h2>
        <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 20px', lineHeight: '1.5' }}>
          <strong style={{ color: '#0D0D0D' }}>{user.display_name ?? user.email}</strong> will be
          immediately signed out and permanently removed from SIGNAL. This cannot be undone.
        </p>

        {error && <p style={{ fontSize: '12px', color: '#DC2626', margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleRevoke} disabled={loading}
            style={{
              flex: 1, padding: '9px 0', border: 'none', borderRadius: '2px',
              backgroundColor: loading ? '#F3F4F6' : '#DC2626',
              color: loading ? '#9CA3AF' : '#FFFFFF',
              fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Revoking…' : 'Revoke Access'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '9px 16px', border: '1px solid #E4E4E4', borderRadius: '2px',
              backgroundColor: '#FFFFFF', color: '#374151', fontSize: '14px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function UsersClient({ users: initialUsers, currentUserId }: {
  users: UserRecord[]
  currentUserId: string
}) {
  const router = useRouter()
  const [showInvite, setShowInvite] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<UserRecord | null>(null)

  function refresh() { router.refresh() }

  const admins = initialUsers.filter(u => u.role === 'admin')
  const staff  = initialUsers.filter(u => u.role === 'staff')

  return (
    <>
      <div style={{ minHeight: '100vh', backgroundColor: '#F8F8F8' }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#FFFFFF', borderBottom: '1px solid #E4E4E4',
          padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#0D0D0D', margin: 0 }}>Users</h1>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>
              Manage who has access to SIGNAL and their roles.
            </p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            style={{
              padding: '8px 18px', border: 'none', borderRadius: '2px',
              backgroundColor: '#E7534F', color: '#FFFFFF',
              fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#D94440')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#E7534F')}
          >
            + Invite User
          </button>
        </div>

        <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <UserSection title="Admins" users={admins} currentUserId={currentUserId} onRevoke={setRevokeTarget} />
          <UserSection title="Staff" users={staff} currentUserId={currentUserId} onRevoke={setRevokeTarget} />
        </div>
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); refresh() }}
        />
      )}
      {revokeTarget && (
        <RevokeModal
          user={revokeTarget}
          onClose={() => setRevokeTarget(null)}
          onRevoked={() => { setRevokeTarget(null); refresh() }}
        />
      )}
    </>
  )
}

function UserSection({ title, users, currentUserId, onRevoke }: {
  title: string
  users: UserRecord[]
  currentUserId: string
  onRevoke: (u: UserRecord) => void
}) {
  return (
    <div>
      <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#0D0D0D', margin: '0 0 14px' }}>{title}</h2>
      {users.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>No {title.toLowerCase()} yet.</p>
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '4px', border: '1px solid #E4E4E4', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E4E4E4' }}>
                {['User', 'Email', 'Role', 'Joined', 'Status', ''].map((col, i) => (
                  <th key={i} style={{
                    padding: '11px 16px', textAlign: 'left', fontSize: '11px',
                    fontWeight: '600', color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isLast={i === users.length - 1}
                  isSelf={u.id === currentUserId}
                  onRevoke={() => onRevoke(u)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  )
}

function UserRow({ user, isLast, isSelf, onRevoke }: {
  user: UserRecord
  isLast: boolean
  isSelf: boolean
  onRevoke: () => void
}) {
  const router = useRouter()
  const isAdmin = user.role === 'admin'
  const avatarBg = isAdmin ? '#E7534F' : '#9CA3AF'

  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(user.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedOk, setSavedOk] = useState(false)

  function cancelEdit() {
    setEditing(false)
    setDraft(user.display_name ?? '')
    setSaveError(null)
  }

  async function handleSave() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === user.display_name) { cancelEdit(); return }
    setSaving(true)
    setSaveError(null)
    const result = await updateDisplayName(user.id, trimmed)
    setSaving(false)
    if (!result.ok) {
      setSaveError(result.error ?? 'Save failed')
    } else {
      setEditing(false)
      setSavedOk(true)
      setTimeout(() => {
        setSavedOk(false)
        router.refresh()
      }, 1500)
    }
  }

  return (
    <tr style={{ borderBottom: isLast ? 'none' : '1px solid #E4E4E4' }}>
      {/* User */}
      <td style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            backgroundColor: avatarBg, color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: '600',
          }}>
            {getInitials(editing ? draft : user.display_name)}
          </div>

          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  autoFocus
                  value={draft}
                  onChange={e => { setDraft(e.target.value); setSaveError(null) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleSave() }
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  disabled={saving}
                  style={{
                    fontSize: '13px', fontWeight: '600', padding: '4px 8px',
                    border: saveError ? '1px solid #DC2626' : '1px solid #E7534F',
                    borderRadius: '2px', outline: 'none', width: '160px',
                    color: '#0D0D0D', backgroundColor: saving ? '#F9FAFB' : '#FFFFFF',
                  }}
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !draft.trim()}
                  style={{
                    padding: '4px 10px', border: 'none', borderRadius: '2px',
                    backgroundColor: saving || !draft.trim() ? '#F3F4F6' : '#E7534F',
                    color: saving || !draft.trim() ? '#9CA3AF' : '#FFFFFF',
                    fontSize: '12px', fontWeight: '600',
                    cursor: saving || !draft.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  style={{
                    padding: '4px 8px', border: '1px solid #E4E4E4', borderRadius: '2px',
                    backgroundColor: '#FFFFFF', color: '#6B7280', fontSize: '12px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
              {saveError && (
                <span style={{ fontSize: '11px', color: '#DC2626' }}>{saveError}</span>
              )}
            </div>
          ) : (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
            >
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#0D0D0D' }}>
                {user.display_name ?? '—'}
              </span>
              {isSelf && (
                <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '400' }}>(you)</span>
              )}
              {savedOk && (
                <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: '500' }}>✓ Saved</span>
              )}
              {hovered && !savedOk && (
                <button
                  onClick={() => setEditing(true)}
                  title="Edit display name"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '2px', color: '#9CA3AF', display: 'flex', alignItems: 'center',
                    borderRadius: '3px',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#E7534F')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                >
                  <PencilIcon />
                </button>
              )}
            </div>
          )}
        </div>
      </td>

      {/* Email */}
      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6B7280' }}>
        {user.email ?? '—'}
      </td>

      {/* Role */}
      <td style={{ padding: '14px 16px' }}>
        <span style={{
          fontSize: '11px', fontWeight: '600', letterSpacing: '0.05em',
          padding: '2px 8px', borderRadius: '4px',
          backgroundColor: isAdmin ? '#FEE9E8' : '#F3F4F6',
          color: isAdmin ? '#E7534F' : '#6B7280',
        }}>
          {isAdmin ? 'Admin' : 'Staff'}
        </span>
      </td>

      {/* Joined */}
      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6B7280', whiteSpace: 'nowrap' }}>
        {formatDate(user.created_at)}
      </td>

      {/* Status */}
      <td style={{ padding: '14px 16px' }}>
        {user.status === 'active' ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#15803D' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#16A34A', display: 'inline-block', flexShrink: 0 }} />
            Active
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#92400E' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#D97706', display: 'inline-block', flexShrink: 0 }} />
            Invited
          </span>
        )}
      </td>

      {/* Actions */}
      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
        {!isSelf && (
          <button
            onClick={onRevoke}
            style={{
              padding: '4px 12px', border: '1px solid #E4E4E4', borderRadius: '2px',
              backgroundColor: '#FFFFFF', color: '#6B7280', fontSize: '12px',
              cursor: 'pointer', fontWeight: '500',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#DC2626'
              e.currentTarget.style.color = '#DC2626'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E5E5E5'
              e.currentTarget.style.color = '#6B7280'
            }}
          >
            Revoke
          </button>
        )}
      </td>
    </tr>
  )
}
