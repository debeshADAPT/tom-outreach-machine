import type { ReactNode } from 'react'

// Shared visual pattern for flagging preview/mock data in the UI.
// Any screen showing fabricated data (not backed by a live integration)
// must use one of these so it's never mistaken for real activity.

export function MockDataBanner({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '8px',
      padding: '10px 14px', marginBottom: '14px',
      backgroundColor: '#FFFBEB', border: '1px solid #F59E0B',
      borderRadius: '2px',
    }}>
      <span style={{
        fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: '#92400E',
        backgroundColor: '#FEF3C7', border: '1px solid #F59E0B',
        borderRadius: '2px', padding: '2px 6px', flexShrink: 0,
        marginTop: '1px', whiteSpace: 'nowrap',
      }}>
        Preview
      </span>
      <span style={{ fontSize: '12px', color: '#92400E', lineHeight: 1.5 }}>
        {children}
      </span>
    </div>
  )
}

export function MockDataTag({ style }: { style?: React.CSSProperties }) {
  return (
    <span style={{
      fontSize: '8px', fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: '#92400E',
      backgroundColor: '#FEF3C7', border: '1px solid #F59E0B',
      borderRadius: '2px', padding: '1px 5px',
      display: 'inline-block', verticalAlign: 'middle',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      Preview
    </span>
  )
}
