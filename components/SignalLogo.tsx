'use client'

import React from 'react'

interface SignalLogoProps {
  size?: 'sm' | 'lg'
}

const BAR_HEIGHTS = [10, 16, 22, 32, 22, 16, 10]
// Delays radiate outward from centre — centre fires first, outermost last
const BAR_DELAYS = ['0.3s', '0.2s', '0.1s', '0s', '0.1s', '0.2s', '0.3s']

export default function SignalLogo({ size = 'lg' }: SignalLogoProps) {
  const isLg = size === 'lg'

  const dotSize = isLg ? 4 : 2.5
  const barWidth = isLg ? 4 : 2.5
  const barGap = isLg ? 4 : 2.5
  const maxBarH = isLg ? 32 : 22
  const wordmarkSize = isLg ? 28 : 13
  const wordmarkTracking = isLg ? '0.18em' : '0.15em'
  const iconMarginBottom = isLg ? 24 : 10
  const underlineHeight = isLg ? 2 : 1.5
  const letterRise = isLg ? 6 : 3

  const totalWidth = dotSize + barGap + (barWidth * 7 + barGap * 6) + barGap + dotSize

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Waveform icon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: `${barGap}px`,
          height: `${maxBarH}px`,
          marginBottom: `${iconMarginBottom}px`,
          width: `${totalWidth}px`,
        }}
      >
        {/* Left dot — pulses in sync with outermost bars (0.3s delay) */}
        <span
          style={{
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            borderRadius: '50%',
            backgroundColor: '#E7534F',
            flexShrink: 0,
            alignSelf: 'center',
            ...(isLg ? { animation: 'signal-pulse 2s ease-in-out 0.3s infinite' } : {}),
          }}
        />

        {/* 7 bars */}
        {BAR_HEIGHTS.map((h, i) => (
          <span
            key={i}
            style={{
              width: `${barWidth}px`,
              borderRadius: '2px',
              backgroundColor: i === 3 ? '#E7534F' : '#9A9A9A',
              flexShrink: 0,
              height: `${h}px`,
              transformOrigin: 'center',
              ...(isLg
                ? { animation: `signal-bar 2s ease-in-out ${BAR_DELAYS[i]} infinite` }
                : {}),
            }}
          />
        ))}

        {/* Right dot */}
        <span
          style={{
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            borderRadius: '50%',
            backgroundColor: '#E7534F',
            flexShrink: 0,
            alignSelf: 'center',
            ...(isLg ? { animation: 'signal-pulse 2s ease-in-out 0.3s infinite' } : {}),
          }}
        />
      </div>

      {/* Wordmark — rendered as inline text so all glyphs share the same baseline/size */}
      <div
        style={{
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontWeight: 700,
          fontSize: `${wordmarkSize}px`,
          letterSpacing: wordmarkTracking,
          textTransform: 'uppercase',
          color: '#FFFFFF',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        SIGN
        {/* A floats above the baseline; underline clipped to glyph width via right: letterSpacing */}
        <span
          style={{
            position: 'relative',
            display: 'inline-block',
            bottom: `${letterRise}px`,
          }}
        >
          A
          <span
            style={{
              position: 'absolute',
              bottom: `-${letterRise + underlineHeight + 2}px`,
              left: 0,
              right: wordmarkTracking,
              height: `${underlineHeight}px`,
              backgroundColor: '#E7534F',
            }}
          />
        </span>
        L
      </div>

      <style>{`
        @keyframes signal-bar {
          0%   { transform: scaleY(1); animation-timing-function: cubic-bezier(0.1, 0, 0.2, 1); }
          6%   { transform: scaleY(2.1); animation-timing-function: cubic-bezier(0.4, 0, 1, 1); }
          18%  { transform: scaleY(1); }
          18%, 100% { transform: scaleY(1); }
        }
        @keyframes signal-pulse {
          0%   { opacity: 0.35; transform: scale(1); animation-timing-function: cubic-bezier(0.1, 0, 0.2, 1); }
          6%   { opacity: 1; transform: scale(1.5); animation-timing-function: cubic-bezier(0.4, 0, 1, 1); }
          18%  { opacity: 0.35; transform: scale(1); }
          18%, 100% { opacity: 0.35; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
