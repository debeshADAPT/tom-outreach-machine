import Link from 'next/link'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'prospects', label: 'Prospects' },
  { id: 'sequence', label: 'Sequence' },
  { id: 'settings', label: 'Settings' },
]

interface Props {
  campaignId: string
  activeTab: string
}

export default function TabNav({ campaignId, activeTab }: Props) {
  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      borderBottom: '1px solid #E5E5E5',
      display: 'flex',
      paddingLeft: '32px',
    }}>
      {TABS.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <Link
            key={tab.id}
            href={`/campaigns/${campaignId}?tab=${tab.id}`}
            style={{
              display: 'inline-block',
              padding: '14px 16px',
              fontSize: '14px',
              fontWeight: isActive ? '600' : '500',
              color: isActive ? '#E7534F' : '#6B7280',
              textDecoration: 'none',
              borderBottom: isActive ? '2px solid #E7534F' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
