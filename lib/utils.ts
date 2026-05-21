export interface StatusBadge {
  label: string
  bg: string
  color: string
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
    case 'unsubscribed':
      return { label: 'Unsubscribed', bg: '#F3F4F6', color: '#6B7280' }
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
  final_follow_up: 'Final follow-up',
}

export function sequenceStepLabel(step: string): string {
  return STEP_LABELS[step] ?? step
}
