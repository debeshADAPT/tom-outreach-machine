import type { Prospect, Campaign } from './types'

export interface StatusBadge {
  label: string
  bg: string
  color: string
}

export function formatDDMMYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}/${mm}/${yy}`
}

export function calculateStepDates(
  prospect: Prospect,
  campaign: Campaign,
): Record<string, Date> {
  const base = new Date(prospect.sent_at ?? campaign.created_at)
  const cd = prospect.custom_delays ?? {}
  const sd = campaign.sequence_delays ?? {}
  const d0 = cd['invite_to_followup1']    ?? sd['invite_to_followup1']    ?? 3
  const d1 = cd['followup1_to_followup2'] ?? sd['followup1_to_followup2'] ?? 4
  const d2 = cd['followup2_to_followup3'] ?? sd['followup2_to_followup3'] ?? 3
  const d3 = cd['followup3_to_final']     ?? sd['followup3_to_final']     ?? 7
  function add(days: number): Date {
    const r = new Date(base)
    r.setDate(r.getDate() + days)
    return r
  }
  return {
    invite_1:   add(0),
    followup_1: add(d0),
    followup_2: add(d0 + d1),
    followup_3: add(d0 + d1 + d2),
    final:      add(d0 + d1 + d2 + d3),
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const parts = dateStr.split('T')[0].split('-').map(Number)
  const [year, month, day] = parts
  return `${day} ${MONTHS[month - 1]} ${year}`
}

export function campaignStatusBadge(status: string): StatusBadge {
  switch (status) {
    case 'active':
      return { label: 'Active', bg: '#DCFCE7', color: '#166534' }
    case 'completed':
      return { label: 'Completed', bg: '#F3F3F1', color: '#6B7280' }
    default:
      return { label: 'Draft', bg: '#F3F3F1', color: '#6B7280' }
  }
}

export function prospectStatusBadge(status: string): StatusBadge {
  switch (status) {
    case 'sent':
      return { label: 'Sent', bg: '#DBEAFE', color: '#1E40AF' }
    case 'replied':
      return { label: 'Replied', bg: '#DCFCE7', color: '#166534' }
    case 'bounced':
      return { label: 'Bounced', bg: '#FEE2E2', color: '#991B1B' }
    case 'declined':
      return { label: 'Declined', bg: '#F3F4F6', color: '#6B7280' }
    default:
      return { label: 'Queued', bg: '#F3F4F6', color: '#6B7280' }
  }
}

const STEP_LABELS: Record<string, string> = {
  not_started: 'Not started',
  invite_1: 'Invite 1',
  follow_up_1: 'Follow-up 1',
  follow_up_2: 'Follow-up 2',
  follow_up_3: 'Follow-up 3',
  followup_1: 'Follow-up 1',
  followup_2: 'Follow-up 2',
  followup_3: 'Follow-up 3',
  final: 'Final',
  final_follow_up: 'Final follow-up',
}

export function sequenceStepLabel(step: string): string {
  return STEP_LABELS[step] ?? step
}
