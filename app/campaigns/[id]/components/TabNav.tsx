import Link from 'next/link'

const TABS = [
  { id: 'dashboard',   label: 'Dashboard'   },
  { id: 'ai-insights', label: 'AI Insights' },
  { id: 'prospects',   label: 'Prospects'   },
  { id: 'sequence',    label: 'Sequence'    },
  { id: 'email-logs', label: 'Email Logs'  },
  { id: 'settings',   label: 'Settings'    },
]

interface Props {
  campaignId: string
  activeTab: string
}

export default function TabNav({ campaignId, activeTab }: Props) {
  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      borderBottom: '1px solid #E4E4E4',
      display: 'flex',
    }}>
      {TABS.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <Link
            key={tab.id}
            href={`/campaigns/${campaignId}?tab=${tab.id}`}
            style={{
              display: 'inline-block',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: isActive ? '600' : '500',
              color: isActive ? '#E7534F' : '#9A9A9A',
              textDecoration: 'none',
              borderBottom: isActive ? '2px solid #E7534F' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'color 0.15s',
              whiteSpace: 'nowrap',
              letterSpacing: '0.01em',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
