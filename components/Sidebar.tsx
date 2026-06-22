'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ flexShrink: 0 }}>
      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ flexShrink: 0 }}>
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  )
}

function IconMail() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ flexShrink: 0 }}>
      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
    </svg>
  )
}

function IconPlug() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

function IconChevronDown({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width={size} height={size} style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

function IconChevronRight({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width={size} height={size} style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  )
}

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  )
}

function IconZap() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
    </svg>
  )
}

function IconSparkles() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ flexShrink: 0 }}>
      <path d="M10 2a.75.75 0 01.712.513l1.3 3.9 3.9 1.3a.75.75 0 010 1.424l-3.9 1.3-1.3 3.9a.75.75 0 01-1.424 0l-1.3-3.9-3.9-1.3a.75.75 0 010-1.424l3.9-1.3 1.3-3.9A.75.75 0 0110 2zM4 14a.5.5 0 01.474.342l.526 1.578 1.578.526a.5.5 0 010 .948l-1.578.526-.526 1.578a.5.5 0 01-.948 0l-.526-1.578-1.578-.526a.5.5 0 010-.948l1.578-.526.526-1.578A.5.5 0 014 14zM16 1a.5.5 0 01.474.342l.526 1.578 1.578.526a.5.5 0 010 .948l-1.578.526-.526 1.578a.5.5 0 01-.948 0l-.526-1.578-1.578-.526a.5.5 0 010-.948l1.578-.526.526-1.578A.5.5 0 0116 1z" />
    </svg>
  )
}

function IconSignOut() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h8a1 1 0 010 2H5v12h7a1 1 0 010 2H4a1 1 0 01-1-1V3zm12.293 4.293a1 1 0 011.414 1.414L14.414 11H9a1 1 0 010-2h5.414l-1.707-1.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

// ─── Logo components ──────────────────────────────────────────────────────────

// Expanded sidebar: SIGNAL wordmark with floating A — matches login page design
function ExpandedLogo() {
  return (
    <div
      style={{
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        fontWeight: 700,
        fontSize: '15px',
        letterSpacing: '0.18em',
        color: '#FFFFFF',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        lineHeight: 1,
      }}
    >
      SIGN
      <span style={{ position: 'relative', display: 'inline-block', bottom: '3px' }}>
        A
        <span
          style={{
            position: 'absolute',
            bottom: '-4.5px',
            left: 0,
            right: '0.18em',
            height: '1.5px',
            backgroundColor: '#E7534F',
          }}
        />
      </span>
      L
    </div>
  )
}

// Collapsed sidebar: 5-bar waveform, static, pulses once on hover
const MINI_BAR_HEIGHTS = [6, 10, 16, 10, 6]
const MINI_BAR_DELAYS  = ['0.2s', '0.1s', '0s', '0.1s', '0.2s']

function CollapsedWaveform() {
  const [pulseKey, setPulseKey] = useState(0)

  return (
    <div
      onMouseEnter={() => setPulseKey(k => k + 1)}
      style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 0', cursor: 'default' }}
    >
      {MINI_BAR_HEIGHTS.map((h, i) => (
        <span
          // key change forces remount → CSS animation replays from 0
          key={`${pulseKey}-${i}`}
          style={{
            width: '3px',
            height: `${h}px`,
            borderRadius: '1.5px',
            backgroundColor: i === 2 ? '#E7534F' : '#9A9A9A',
            display: 'block',
            transformOrigin: 'center',
            animation: pulseKey > 0
              ? `signal-bar-once 0.65s ease-out ${MINI_BAR_DELAYS[i]} 1 forwards`
              : 'none',
          }}
        />
      ))}
      <style>{`
        @keyframes signal-bar-once {
          0%  { transform: scaleY(1); animation-timing-function: cubic-bezier(0.1,0,0.2,1); }
          7%  { transform: scaleY(2.2); animation-timing-function: cubic-bezier(0.4,0,1,1); }
          22% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  display_name: string | null
  role: string | null
}

interface RecentCampaign {
  id: string
  name: string
  event_date: string | null
}

const DISABLED_ITEMS = [
  { label: 'Contacts',        icon: <IconUsers />,  key: 'contacts' },
  { label: 'Email Templates', icon: <IconMail />,   key: 'templates' },
  { label: 'Connectors',      icon: <IconPlug />,   key: 'connectors' },
]

// Nav item wrapper: provides the red left-border for active state
function NavBorder({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div style={{ borderLeft: active ? '2px solid #E7534F' : '2px solid transparent' }}>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [campaignsOpen, setCampaignsOpen] = useState(false)
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>([])
  const [flyoutVisible, setFlyoutVisible] = useState(false)
  const [flyoutTop, setFlyoutTop] = useState(0)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const campaignsIconRef = useRef<HTMLDivElement>(null)

  const isCampaignsActive = pathname.startsWith('/campaigns')
  const isEventsActive = pathname.startsWith('/events')
  const isAiContextActive = pathname.startsWith('/ai-context')
  const isEdgeActive = pathname.startsWith('/edge')
  const isUsersActive = pathname.startsWith('/users')
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    const supabase = createSupabaseBrowser()

    async function fetchProfile(userId: string) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('display_name, role')
          .eq('id', userId)
          .single()
        if (data) setProfile(data as UserProfile)
      } catch {
        // non-critical
      }
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) fetchProfile(user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    async function tryFetch() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('display_name, role')
        .eq('id', user.id)
        .single()
      if (data) setProfile(data as UserProfile)
    }
    tryFetch().catch(() => {})
  }, [pathname])

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const supabase = createSupabaseBrowser()
        const { data } = await supabase
          .from('campaigns')
          .select('id, name, event_date')
          .order('last_visited_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(5)
        setRecentCampaigns((data ?? []) as RecentCampaign[])
      } catch {
        // non-critical
      }
    }
    fetchCampaigns()
  }, [pathname])

  if (pathname === '/login') return null

  async function handleSignOut() {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar_collapsed', String(next))
    if (next) setCampaignsOpen(false)
  }

  function handleCampaignsIconEnter() {
    if (campaignsIconRef.current) {
      const rect = campaignsIconRef.current.getBoundingClientRect()
      setFlyoutTop(rect.top)
    }
    setFlyoutVisible(true)
  }

  const navItemBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center',
    textDecoration: 'none', fontSize: '13px', fontWeight: '500',
    overflow: 'hidden', letterSpacing: '0.01em',
  }

  return (
    <aside
      style={{
        width: collapsed ? '56px' : '220px',
        minWidth: collapsed ? '56px' : '220px',
        transition: 'width 200ms ease, min-width 200ms ease',
        backgroundColor: '#0A0A0A',
        borderRight: '1px solid #1C1C1C',
        position: 'relative',
        zIndex: 20,
        overflow: 'visible',
      }}
      className="h-screen flex flex-col flex-shrink-0"
    >
      {/* Logo */}
      <div
        style={{
          display: 'flex', alignItems: 'center', minHeight: '64px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '20px 0' : '20px 16px',
          overflow: 'hidden',
        }}
      >
        {/* Collapsed: mini waveform */}
        <div style={{
          opacity: collapsed ? 1 : 0,
          width: collapsed ? 'auto' : 0,
          overflow: 'hidden',
          transition: 'opacity 150ms ease',
          flexShrink: 0,
        }}>
          <CollapsedWaveform />
        </div>
        {/* Expanded: SIGNAL wordmark with floating A */}
        <div style={{
          opacity: collapsed ? 0 : 1,
          width: collapsed ? 0 : 'auto',
          overflow: collapsed ? 'hidden' : 'visible',
          transition: 'opacity 200ms ease',
          flexShrink: 0,
        }}>
          <ExpandedLogo />
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-2 mt-1 flex-1">

        {/* Events Hub */}
        <NavBorder active={isEventsActive}>
          <Link
            href="/events"
            style={{
              ...navItemBase,
              gap: collapsed ? 0 : '10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '8px' : '7px 10px',
              color: isEventsActive ? '#FFFFFF' : '#9A9A9A',
            }}
            className={!isEventsActive ? 'hover:bg-white/[0.06] hover:text-white transition-colors' : ''}
            title="Events Hub"
          >
            <span style={{ flexShrink: 0 }}><IconCalendar /></span>
            {!collapsed && (
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Events Hub
              </span>
            )}
          </Link>
        </NavBorder>

        {/* My Campaigns */}
        {collapsed ? (
          <div
            ref={campaignsIconRef}
            onMouseEnter={handleCampaignsIconEnter}
            onMouseLeave={() => setFlyoutVisible(false)}
          >
            <NavBorder active={isCampaignsActive}>
              <Link
                href="/campaigns"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '8px', height: '34px',
                  color: isCampaignsActive ? '#FFFFFF' : '#9A9A9A',
                  textDecoration: 'none',
                }}
                className={!isCampaignsActive ? 'hover:bg-white/[0.06] hover:text-white transition-colors' : ''}
              >
                <IconGrid />
              </Link>
            </NavBorder>

            {flyoutVisible && recentCampaigns.length > 0 && (
              <div
                style={{
                  position: 'fixed', left: '62px', top: flyoutTop,
                  backgroundColor: '#FFFFFF', border: '1px solid #E4E4E4',
                  borderRadius: '2px',
                  width: '210px', zIndex: 1000, padding: '6px 0',
                }}
              >
                <div style={{
                  fontSize: '10px', fontWeight: '600', color: '#9A9A9A',
                  padding: '4px 12px 6px', textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  Recent Campaigns
                </div>
                {recentCampaigns.map(c => (
                  <Link
                    key={c.id}
                    href={`/campaigns/${c.id}`}
                    style={{ display: 'block', padding: '8px 12px', textDecoration: 'none' }}
                    className="hover:bg-[#F8F8F8] transition-colors"
                  >
                    <div style={{
                      fontSize: '12px', color: '#0A0A0A', fontWeight: '500',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.name.length > 24 ? c.name.slice(0, 24) + '…' : c.name}
                    </div>
                    {c.event_date && (
                      <div style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '1px' }}>
                        {new Date(c.event_date + 'T00:00:00').toLocaleDateString('en-AU', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <NavBorder active={isCampaignsActive}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Link
                  href="/campaigns"
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '7px 10px',
                    color: isCampaignsActive ? '#FFFFFF' : '#9A9A9A',
                    textDecoration: 'none', fontSize: '13px', fontWeight: '500',
                    minWidth: 0,
                  }}
                  className={!isCampaignsActive ? 'hover:bg-white/[0.06] hover:text-white transition-colors' : ''}
                >
                  <IconGrid />
                  <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    My Campaigns
                  </span>
                </Link>
                <button
                  onClick={() => setCampaignsOpen(o => !o)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '6px', flexShrink: 0,
                    color: '#5F5F5F',
                    borderRadius: '2px',
                  }}
                  className="hover:text-white transition-colors"
                  title={campaignsOpen ? 'Collapse recent' : 'Expand recent'}
                >
                  {campaignsOpen ? <IconChevronDown /> : <IconChevronRight />}
                </button>
              </div>
            </NavBorder>

            {campaignsOpen && recentCampaigns.length > 0 && (
              <div style={{ paddingLeft: '16px', marginTop: '2px' }}>
                {recentCampaigns.map(c => (
                  <Link
                    key={c.id}
                    href={`/campaigns/${c.id}`}
                    style={{
                      display: 'block', padding: '7px 12px',
                      borderRadius: '0', textDecoration: 'none',
                    }}
                    className="hover:bg-white/[0.06] transition-colors"
                  >
                    <div style={{
                      fontSize: '12px', color: '#9A9A9A',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.name.length > 24 ? c.name.slice(0, 24) + '…' : c.name}
                    </div>
                    {c.event_date && (
                      <div style={{ fontSize: '11px', color: '#5F5F5F', marginTop: '1px' }}>
                        {new Date(c.event_date + 'T00:00:00').toLocaleDateString('en-AU', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* AI Context Creator */}
        <NavBorder active={isAiContextActive}>
          <Link
            href="/ai-context"
            style={{
              ...navItemBase,
              gap: collapsed ? 0 : '10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '8px' : '7px 10px',
              color: isAiContextActive ? '#FFFFFF' : '#9A9A9A',
            }}
            className={!isAiContextActive ? 'hover:bg-white/[0.06] hover:text-white transition-colors' : ''}
            title="AI Context Creator"
          >
            <span style={{ flexShrink: 0 }}><IconSparkles /></span>
            {!collapsed && (
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                AI Context
              </span>
            )}
          </Link>
        </NavBorder>

        {/* Edge */}
        <NavBorder active={isEdgeActive}>
          <Link
            href="/edge"
            style={{
              ...navItemBase,
              gap: collapsed ? 0 : '10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '8px' : '7px 10px',
              color: isEdgeActive ? '#FFFFFF' : '#9A9A9A',
            }}
            className={!isEdgeActive ? 'hover:bg-white/[0.06] hover:text-white transition-colors' : ''}
            title="ADAPT Edge"
          >
            <span style={{ flexShrink: 0 }}><IconZap /></span>
            {!collapsed && (
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Edge
              </span>
            )}
          </Link>
        </NavBorder>

        {/* Users — admin only */}
        {isAdmin && (
          <NavBorder active={isUsersActive}>
            <Link
              href="/users"
              style={{
                ...navItemBase,
                gap: collapsed ? 0 : '10px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '8px' : '7px 10px',
                color: isUsersActive ? '#FFFFFF' : '#9A9A9A',
              }}
              className={!isUsersActive ? 'hover:bg-white/[0.06] hover:text-white transition-colors' : ''}
              title="Users"
            >
              <span style={{ flexShrink: 0 }}><IconUsers /></span>
              {!collapsed && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Users
                </span>
              )}
            </Link>
          </NavBorder>
        )}

        {/* Disabled items */}
        {DISABLED_ITEMS.map(item => (
          <div
            key={item.key}
            title="Coming soon"
            style={{
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : '10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '8px' : '7px 10px',
              color: '#3A3A3A', opacity: 0.5,
              cursor: 'not-allowed',
              fontSize: '13px', fontWeight: '500',
              userSelect: 'none',
              overflow: 'hidden',
            }}
          >
            {item.icon}
            {!collapsed && (
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.label}
              </span>
            )}
          </div>
        ))}
      </nav>

      {/* Footer: Profile + Sign Out + Collapse toggle */}
      <div className="px-2 pb-5" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>

        {/* Profile indicator */}
        {collapsed ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 2px' }}>
            <div
              title={profile ? `${profile.display_name ?? 'Unknown'} · ${profile.role === 'admin' ? 'Admin' : 'Staff'}` : 'Loading…'}
              style={{
                width: '30px', height: '30px', borderRadius: '50%',
                backgroundColor: profile?.role === 'admin' ? '#E7534F' : '#3A3A3A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#FFFFFF', fontSize: '11px', fontWeight: '600',
                flexShrink: 0, cursor: 'default', userSelect: 'none',
              }}
            >
              {getInitials(profile?.display_name)}
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 10px',
              borderTop: '1px solid #1C1C1C',
              marginBottom: '2px',
            }}
          >
            <div
              style={{
                width: '30px', height: '30px', borderRadius: '50%',
                backgroundColor: profile?.role === 'admin' ? '#E7534F' : '#3A3A3A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#FFFFFF', fontSize: '11px', fontWeight: '600',
                flexShrink: 0, userSelect: 'none',
              }}
            >
              {getInitials(profile?.display_name)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: '12px', fontWeight: '600', color: '#FFFFFF',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {profile?.display_name ?? '…'}
              </div>
              <div style={{ marginTop: '2px' }}>
                <span style={{
                  fontSize: '10px', fontWeight: '600', letterSpacing: '0.06em',
                  padding: '1px 5px',
                  textTransform: 'uppercase',
                  color: profile?.role === 'admin' ? '#E7534F' : '#5F5F5F',
                }}>
                  {profile?.role === 'admin' ? 'Admin' : 'Staff'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          title="Sign out"
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: collapsed ? 0 : '10px',
            padding: collapsed ? '8px' : '7px 10px',
            border: 'none', borderRadius: '0',
            backgroundColor: 'transparent', color: '#5F5F5F',
            cursor: 'pointer', fontSize: '13px', fontWeight: '500',
            overflow: 'hidden', whiteSpace: 'nowrap',
            transition: 'background-color 0.15s, color 0.15s',
          }}
          className="hover:bg-white/[0.06] hover:text-white"
        >
          <IconSignOut />
          {!collapsed && <span>Sign Out</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '8px',
            padding: collapsed ? '8px' : '6px 10px',
            border: '1px solid #2A2A2A', borderRadius: '2px',
            backgroundColor: 'transparent', color: '#5F5F5F',
            cursor: 'pointer', fontSize: '11px',
            overflow: 'hidden', whiteSpace: 'nowrap',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          className="hover:border-[#E7534F] hover:text-[#E7534F]"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <IconChevronRight /> : (
            <>
              <IconChevronLeft />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
