'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'

const navItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Contacts', href: '/contacts' },
  { label: 'Email Templates', href: '/email-templates' },
  { label: 'Connectors', href: '/connectors' },
]

export default function Sidebar() {
  const pathname = usePathname()

  if (pathname === '/login') return null

  return (
    <aside
      style={{ backgroundColor: '#0D0D0D', borderRight: '1px solid #1f1f1f' }}
      className="w-56 min-h-screen flex flex-col flex-shrink-0"
    >
      <div className="px-6 py-6 flex items-center gap-2">
        <span className="text-white font-bold text-2xl tracking-tight">TOM</span>
        <span
          style={{ backgroundColor: '#e7534f' }}
          className="w-2 h-2 rounded-full mt-0.5"
        />
      </div>

      <nav className="flex flex-col gap-1 px-3 mt-2 flex-1">
        {navItems.map(({ label, href }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              style={
                active
                  ? { backgroundColor: '#e7534f', color: '#ffffff' }
                  : { color: '#a3a3a3' }
              }
              className="px-3 py-2 rounded-md text-sm font-medium transition-colors hover:text-white hover:bg-white/10"
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
            className="w-full px-3 py-2 rounded-md text-sm font-medium text-left transition-colors hover:bg-white/10"
            style={{ color: '#a3a3a3' }}
          >
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  )
}
