'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null)

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#0A0A0A' }}
    >
      <div className="w-full max-w-sm px-4">
        <div className="flex flex-col items-center mb-10">
          <span
            style={{
              color: '#FFFFFF',
              fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
              fontWeight: 700, fontSize: '28px', letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            SIGNAL
          </span>
          <p className="mt-2 text-xs tracking-widest uppercase" style={{ color: '#5F5F5F', letterSpacing: '0.12em' }}>
            by ADAPT
          </p>
        </div>

        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium uppercase tracking-wide" style={{ color: '#5F5F5F', letterSpacing: '0.08em' }}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full px-3 py-2.5 text-sm outline-none transition-colors focus:ring-1"
              style={{
                backgroundColor: '#141414',
                border: '1px solid #2A2A2A',
                borderRadius: '2px',
                color: '#FFFFFF',
                '--tw-ring-color': '#E7534F',
              } as React.CSSProperties}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium uppercase tracking-wide" style={{ color: '#5F5F5F', letterSpacing: '0.08em' }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full px-3 py-2.5 text-sm outline-none transition-colors focus:ring-1"
              style={{
                backgroundColor: '#141414',
                border: '1px solid #2A2A2A',
                borderRadius: '2px',
                color: '#FFFFFF',
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
            className="mt-2 w-full py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#E7534F', borderRadius: '2px' }}
          >
            {pending ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
