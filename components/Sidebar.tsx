'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'

const navItems = [
  { label: 'My Campaigns', href: '/campaigns' },
  { label: 'Contacts', href: '/contacts' },
  { label: 'Email Templates', href: '/email-templates' },
  { label: 'Connectors', href: '/connectors' },
]

export default function Sidebar() {
  const pathname = usePathname()

  if (pathname === '/login') return null

  return (
    <aside
      style={{ backgroundColor: '#FFFFFF', borderRight: '1px solid #E5E5E5' }}
      className="w-56 h-screen flex flex-col flex-shrink-0"
    >
      <div className="px-6 py-6 flex items-center gap-2">
        <span style={{ color: '#0D0D0D' }} className="font-bold text-2xl tracking-tight">TOM</span>
        <span
          style={{ backgroundColor: '#E7534F' }}
          className="w-2 h-2 rounded-full mt-0.5"
        />
      </div>

      <nav className="flex flex-col gap-1 px-3 mt-2 flex-1">
        {navItems.map(({ label, href }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              style={
                active
                  ? { backgroundColor: '#E7534F', color: '#FFFFFF' }
                  : { color: '#6B7280' }
              }
              className="px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-[#F3F3F1] hover:text-[#0D0D0D]"
            >
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-6">
        <form action={logout}>
          <button
            type="submit"
            className="w-full text-sm font-medium transition-colors"
            style={{
              padding: '7px 12px',
              border: '1px solid #E5E5E5',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              color: '#0D0D0D',
              cursor: 'pointer',
              textAlign: 'center',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#0D0D0D'
              e.currentTarget.style.borderColor = '#0D0D0D'
              e.currentTarget.style.color = '#FFFFFF'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.borderColor = '#E5E5E5'
              e.currentTarget.style.color = '#0D0D0D'
            }}
          >
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  )
}
