const stats = [
  { label: 'Active Campaigns', value: '—' },
  { label: 'Contacts in Sequence', value: '—' },
  { label: 'Emails Sent This Week', value: '—' },
]

export default function DashboardPage() {
  return (
    <div className="p-10">
      <h1 className="text-4xl font-bold text-white">Welcome to TOM</h1>
      <p className="mt-2 text-lg" style={{ color: '#a3a3a3' }}>
        The Outreach Machine
      </p>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            style={{ backgroundColor: '#141414', border: '1px solid #1f1f1f' }}
            className="rounded-xl p-6"
          >
            <p className="text-sm font-medium" style={{ color: '#a3a3a3' }}>
              {label}
            </p>
            <p className="mt-3 text-3xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
