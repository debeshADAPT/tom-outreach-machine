import type { Prospect } from './types'
import { sequenceStepLabel } from './utils'

export function exportCampaignData(prospects: Prospect[], campaignName: string) {
  const headers = ['Name', 'Email', 'Company', 'Industry', 'Title', 'Org Size', 'Sequence Step', 'Status', 'Last Updated']
  const data = prospects.map(p => [
    p.full_name ?? '',
    p.email ?? '',
    p.company ?? '',
    p.industry ?? '',
    p.title ?? '',
    p.org_size ?? '',
    sequenceStepLabel(p.sequence_step),
    p.status,
    p.sent_at ? new Date(p.sent_at).toLocaleDateString('en-AU') : '',
  ])
  const csv = [headers, ...data]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${campaignName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-export.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
