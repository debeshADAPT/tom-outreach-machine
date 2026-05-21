import type { Campaign, Prospect } from '@/lib/types'
import { sequenceStepLabel } from '@/lib/utils'

interface Props {
  campaign: Campaign
  prospects: Prospect[]
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
      borderRadius: '10px', padding: '20px 24px',
    }}>
      <p style={{ fontSize: '13px', color: '#6B7280', fontWeight: '500', marginBottom: '8px' }}>{label}</p>
      <p style={{ fontSize: '32px', fontWeight: '700', color: '#0D0D0D' }}>{value}</p>
    </div>
  )
}

export default function OverviewTab({ prospects }: Props) {
  if (prospects.length === 0) {
    return (
      <div style={{
        backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
        borderRadius: '12px', padding: '60px 24px', textAlign: 'center',
      }}>
        <p style={{ fontSize: '16px', fontWeight: '600', color: '#0D0D0D', marginBottom: '8px' }}>
          No prospects yet
        </p>
        <p style={{ fontSize: '14px', color: '#6B7280' }}>
          Go to the Prospects tab to upload contacts and get started.
        </p>
      </div>
    )
  }

  const total = prospects.length
  const sent = prospects.filter(p => p.status !== 'queued').length
  const replied = prospects.filter(p => p.status === 'replied').length
  const bounced = prospects.filter(p => p.status === 'bounced').length

  // Sequence step breakdown
  const stepCounts = prospects.reduce<Record<string, number>>((acc, p) => {
    acc[p.sequence_step] = (acc[p.sequence_step] ?? 0) + 1
    return acc
  }, {})

  const stepOrder = ['not_started', 'invite_1', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'final_follow_up']
  const steps = stepOrder
    .filter(s => stepCounts[s] != null)
    .map(s => ({ key: s, label: sequenceStepLabel(s), count: stepCounts[s] }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <StatCard label="Total Prospects" value={total} />
        <StatCard label="Emails Sent" value={sent} />
        <StatCard label="Replies" value={replied} />
        <StatCard label="Bounced" value={bounced} />
      </div>

      {/* Sequence breakdown */}
      {steps.length > 0 && (
        <div style={{
          backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
          borderRadius: '10px', overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E5E5' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#0D0D0D', margin: 0 }}>
              Sequence Stage Breakdown
            </h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
                <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stage</th>
                <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prospects</th>
                <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>% of Total</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step, i) => (
                <tr key={step.key} style={{ borderBottom: i < steps.length - 1 ? '1px solid #E5E5E5' : 'none' }}>
                  <td style={{ padding: '12px 20px', fontSize: '14px', color: '#0D0D0D' }}>{step.label}</td>
                  <td style={{ padding: '12px 20px', fontSize: '14px', color: '#0D0D0D', textAlign: 'right', fontWeight: '500' }}>{step.count}</td>
                  <td style={{ padding: '12px 20px', fontSize: '14px', color: '#6B7280', textAlign: 'right' }}>
                    {Math.round((step.count / total) * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
