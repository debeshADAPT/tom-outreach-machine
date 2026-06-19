'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { signOut } from '@/app/actions/auth'

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17" style={{ flexShrink: 0 }}>
      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17" style={{ flexShrink: 0 }}>
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  )
}

function IconMail() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17" style={{ flexShrink: 0 }}>
      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
    </svg>
  )
}

function IconPlug() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17" style={{ flexShrink: 0 }}>
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

function IconZap() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
    </svg>
  )
}

function IconSparkles() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17" style={{ flexShrink: 0 }}>
      <path d="M10 2a.75.75 0 01.712.513l1.3 3.9 3.9 1.3a.75.75 0 010 1.424l-3.9 1.3-1.3 3.9a.75.75 0 01-1.424 0l-1.3-3.9-3.9-1.3a.75.75 0 010-1.424l3.9-1.3 1.3-3.9A.75.75 0 0110 2zM4 14a.5.5 0 01.474.342l.526 1.578 1.578.526a.5.5 0 010 .948l-1.578.526-.526 1.578a.5.5 0 01-.948 0l-.526-1.578-1.578-.526a.5.5 0 010-.948l1.578-.526.526-1.578A.5.5 0 014 14zM16 1a.5.5 0 01.474.342l.526 1.578 1.578.526a.5.5 0 010 .948l-1.578.526-.526 1.578a.5.5 0 01-.948 0l-.526-1.578-1.578-.526a.5.5 0 010-.948l1.578-.526.526-1.578A.5.5 0 0116 1z" />
    </svg>
  )
}

function IconSignOut() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h8a1 1 0 010 2H5v12h7a1 1 0 010 2H4a1 1 0 01-1-1V3zm12.293 4.293a1 1 0 011.414 1.414L14.414 11H9a1 1 0 010-2h5.414l-1.707-1.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [campaignsOpen, setCampaignsOpen] = useState(false)
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>([])
  const [flyoutVisible, setFlyoutVisible] = useState(false)
  const [flyoutTop, setFlyoutTop] = useState(0)
  const campaignsIconRef = useRef<HTMLDivElement>(null)

  const isCampaignsActive = pathname.startsWith('/campaigns')
  const isAiContextActive = pathname.startsWith('/ai-context')
  const isEdgeActive = pathname.startsWith('/edge')

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

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

  return (
    <aside
      style={{
        width: collapsed ? '56px' : '220px',
        minWidth: collapsed ? '56px' : '220px',
        transition: 'width 200ms ease, min-width 200ms ease',
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid #E5E5E5',
        position: 'relative',
        zIndex: 20,
        overflow: 'visible',
      }}
      className="h-screen flex flex-col flex-shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center px-4 py-5 overflow-hidden" style={{ minHeight: '64px' }}>
        <span style={{ color: '#0D0D0D', flexShrink: 0 }} className="font-bold text-2xl tracking-tight">T</span>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '2px',
            overflow: 'hidden',
            width: collapsed ? '0px' : '60px',
            opacity: collapsed ? 0 : 1,
            transition: 'width 200ms ease, opacity 150ms ease',
          }}
        >
          <span style={{ color: '#0D0D0D', whiteSpace: 'nowrap' }} className="font-bold text-2xl tracking-tight">OM</span>
          <span style={{ backgroundColor: '#E7534F' }} className="w-2 h-2 rounded-full mt-0.5 ml-0.5 flex-shrink-0" />
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-2 mt-1 flex-1">

        {/* My Campaigns */}
        {collapsed ? (
          // Collapsed: icon only + flyout on hover
          <div
            ref={campaignsIconRef}
            onMouseEnter={handleCampaignsIconEnter}
            onMouseLeave={() => setFlyoutVisible(false)}
          >
            <Link
              href="/campaigns"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '8px', borderRadius: '6px', height: '36px',
                color: isCampaignsActive ? '#FFFFFF' : '#6B7280',
                backgroundColor: isCampaignsActive ? '#E7534F' : 'transparent',
                textDecoration: 'none',
              }}
              className={!isCampaignsActive ? 'hover:bg-[#F3F3F1] transition-colors' : ''}
            >
              <IconGrid />
            </Link>

            {/* Flyout */}
            {flyoutVisible && recentCampaigns.length > 0 && (
              <div
                style={{
                  position: 'fixed', left: '62px', top: flyoutTop,
                  backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
                  borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  width: '210px', zIndex: 1000, padding: '6px 0',
                }}
              >
                <div style={{
                  fontSize: '10px', fontWeight: '600', color: '#9CA3AF',
                  padding: '4px 12px 6px', textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  Recent Campaigns
                </div>
                {recentCampaigns.map(c => (
                  <Link
                    key={c.id}
                    href={`/campaigns/${c.id}`}
                    style={{ display: 'block', padding: '8px 12px', textDecoration: 'none' }}
                    className="hover:bg-[#F0F0EE] transition-colors"
                  >
                    <div style={{
                      fontSize: '12px', color: '#0D0D0D', fontWeight: '500',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.name.length > 24 ? c.name.slice(0, 24) + '…' : c.name}
                    </div>
                    {c.event_date && (
                      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>
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
          // Expanded: label + chevron sub-list
          <>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Link
                href="/campaigns"
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 10px', borderRadius: '6px',
                  color: isCampaignsActive ? '#FFFFFF' : '#6B7280',
                  backgroundColor: isCampaignsActive ? '#E7534F' : 'transparent',
                  textDecoration: 'none', fontSize: '14px', fontWeight: '500',
                  minWidth: 0,
                }}
                className={!isCampaignsActive ? 'hover:bg-[#F3F3F1] hover:text-[#0D0D0D] transition-colors' : ''}
              >
                <span style={{ color: isCampaignsActive ? '#FFFFFF' : '#6B7280' }}>
                  <IconGrid />
                </span>
                <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  My Campaigns
                </span>
              </Link>
              <button
                onClick={() => setCampaignsOpen(o => !o)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px', flexShrink: 0,
                  color: isCampaignsActive ? '#FFFFFF' : '#9CA3AF',
                  borderRadius: '4px',
                }}
                className="hover:text-[#6B7280] transition-colors"
                title={campaignsOpen ? 'Collapse recent' : 'Expand recent'}
              >
                {campaignsOpen ? <IconChevronDown /> : <IconChevronRight />}
              </button>
            </div>

            {campaignsOpen && recentCampaigns.length > 0 && (
              <div style={{ paddingLeft: '16px', marginTop: '2px' }}>
                {recentCampaigns.map(c => (
                  <Link
                    key={c.id}
                    href={`/campaigns/${c.id}`}
                    style={{
                      display: 'block', padding: '8px 12px',
                      borderRadius: '4px', textDecoration: 'none',
                    }}
                    className="hover:bg-[#F0F0EE] transition-colors"
                  >
                    <div style={{
                      fontSize: '12px', color: '#6B7280',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.name.length > 24 ? c.name.slice(0, 24) + '…' : c.name}
                    </div>
                    {c.event_date && (
                      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>
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
        <Link
          href="/ai-context"
          style={{
            display: 'flex', alignItems: 'center',
            gap: collapsed ? 0 : '10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '8px' : '8px 10px',
            borderRadius: '6px',
            color: isAiContextActive ? '#FFFFFF' : '#6B7280',
            backgroundColor: isAiContextActive ? '#E7534F' : 'transparent',
            textDecoration: 'none', fontSize: '14px', fontWeight: '500',
            overflow: 'hidden',
          }}
          className={!isAiContextActive ? 'hover:bg-[#F3F3F1] hover:text-[#0D0D0D] transition-colors' : ''}
          title="AI Context Creator"
        >
          <span style={{ color: isAiContextActive ? '#FFFFFF' : '#6B7280', flexShrink: 0 }}>
            <IconSparkles />
          </span>
          {!collapsed && (
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              AI Context
            </span>
          )}
        </Link>

        {/* Edge */}
        <Link
          href="/edge"
          style={{
            display: 'flex', alignItems: 'center',
            gap: collapsed ? 0 : '10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '8px' : '8px 10px',
            borderRadius: '6px',
            color: isEdgeActive ? '#FFFFFF' : '#6B7280',
            backgroundColor: isEdgeActive ? '#E7534F' : 'transparent',
            textDecoration: 'none', fontSize: '14px', fontWeight: '500',
            overflow: 'hidden',
          }}
          className={!isEdgeActive ? 'hover:bg-[#F3F3F1] hover:text-[#0D0D0D] transition-colors' : ''}
          title="ADAPT Edge"
        >
          <span style={{ color: isEdgeActive ? '#FFFFFF' : '#6B7280', flexShrink: 0 }}>
            <IconZap />
          </span>
          {!collapsed && (
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Edge
            </span>
          )}
        </Link>

        {/* Disabled items */}
        {DISABLED_ITEMS.map(item => (
          <div
            key={item.key}
            title="Coming soon"
            style={{
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : '10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '8px' : '8px 10px',
              borderRadius: '6px',
              color: '#6B7280', opacity: 0.45,
              cursor: 'not-allowed',
              fontSize: '14px', fontWeight: '500',
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

      {/* Footer: Sign Out + Collapse toggle */}
      <div className="px-2 pb-5" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Sign Out */}
        <form action={signOut} style={{ width: '100%' }}>
          <button
            type="submit"
            title="Sign out"
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: collapsed ? 0 : '10px',
              padding: collapsed ? '8px' : '8px 10px',
              border: 'none', borderRadius: '6px',
              backgroundColor: 'transparent', color: '#6B7280',
              cursor: 'pointer', fontSize: '14px', fontWeight: '500',
              overflow: 'hidden', whiteSpace: 'nowrap',
              transition: 'background-color 0.15s, color 0.15s',
            }}
            className="hover:bg-[#F3F3F1] hover:text-[#0D0D0D]"
          >
            <IconSignOut />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </form>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '8px',
            padding: collapsed ? '8px' : '7px 10px',
            border: '1px solid #E5E5E5', borderRadius: '6px',
            backgroundColor: '#FFFFFF', color: '#9CA3AF',
            cursor: 'pointer', fontSize: '12px',
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
