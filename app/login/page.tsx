'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { login } from '@/app/actions/auth'
import SignalLogo from '@/components/SignalLogo'
import GlobeBackground from '@/components/GlobeBackground'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null)
  const [cardHovered, setCardHovered] = useState(false)
  const [btnHovered, setBtnHovered] = useState(false)

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#0A0A0A', position: 'relative', overflow: 'hidden' }}
    >
      <GlobeBackground />

      {/* Card */}
      <div
        onMouseEnter={() => setCardHovered(true)}
        onMouseLeave={() => setCardHovered(false)}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '400px',
          padding: '40px 36px',
          backgroundColor: 'rgba(14, 14, 14, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '8px',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          transition: 'box-shadow 0.4s ease',
          boxShadow: cardHovered
            ? '0 0 60px rgba(231,83,79,0.07), 0 0 120px rgba(231,83,79,0.03)'
            : '0 0 0 rgba(0,0,0,0)',
        }}
      >
        <div className="flex flex-col items-center mb-10">
          <SignalLogo size="lg" />
        </div>

        <form action={action} className="flex flex-col gap-3">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Email"
            required
            className="w-full px-3 py-2.5 text-sm outline-none transition-colors focus:ring-1"
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px',
              color: '#FFFFFF',
              '--tw-ring-color': '#E7534F',
            } as React.CSSProperties}
          />

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            required
            className="w-full px-3 py-2.5 text-sm outline-none transition-colors focus:ring-1"
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px',
              color: '#FFFFFF',
              '--tw-ring-color': '#E7534F',
            } as React.CSSProperties}
          />

          {state?.error && (
            <p className="text-sm text-center" style={{ color: '#E7534F' }}>
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => setBtnHovered(false)}
            className="mt-2 w-full py-2.5 text-xs font-semibold tracking-widest uppercase disabled:opacity-50"
            style={{
              borderRadius: '4px',
              border: `1px solid ${btnHovered ? '#E7534F' : 'rgba(255,255,255,0.15)'}`,
              backgroundColor: btnHovered ? '#E7534F' : 'transparent',
              color: '#FFFFFF',
              letterSpacing: '0.12em',
              transition: 'background-color 0.2s ease, border-color 0.2s ease',
              cursor: pending ? 'not-allowed' : 'pointer',
            }}
          >
            {pending ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
