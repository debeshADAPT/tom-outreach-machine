'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null)

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#0D0D0D' }}
    >
      <div className="w-full max-w-sm px-4">
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-4xl tracking-tight">TOM</span>
            <span
              style={{ backgroundColor: '#E7534F' }}
              className="w-2.5 h-2.5 rounded-full"
            />
          </div>
          <p className="mt-2 text-sm" style={{ color: '#a3a3a3' }}>
            The Outreach Machine
          </p>
        </div>

        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium" style={{ color: '#a3a3a3' }}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-md px-3 py-2.5 text-sm text-white outline-none transition-colors focus:ring-1"
              style={{
                backgroundColor: '#141414',
                border: '1px solid #2a2a2a',
                '--tw-ring-color': '#E7534F',
              } as React.CSSProperties}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium" style={{ color: '#a3a3a3' }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-md px-3 py-2.5 text-sm text-white outline-none transition-colors focus:ring-1"
              style={{
                backgroundColor: '#141414',
                border: '1px solid #2a2a2a',
                '--tw-ring-color': '#E7534F',
              } as React.CSSProperties}
            />
          </div>

          {state?.error && (
            <p className="text-sm text-center" style={{ color: '#E7534F' }}>
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 w-full rounded-md py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#E7534F' }}
          >
            {pending ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
