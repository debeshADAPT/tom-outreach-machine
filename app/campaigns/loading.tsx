function Bone({ w, h, radius = 4 }: { w: number | string; h: number; radius?: number }) {
  return (
    <div
      className="animate-pulse"
      style={{ width: w, height: `${h}px`, backgroundColor: '#E5E5E5', borderRadius: `${radius}px`, flexShrink: 0 }}
    />
  )
}

export default function CampaignsLoading() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F6F3', padding: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Bone w={160} h={28} radius={6} />
          <Bone w={80} h={14} />
        </div>
        <Bone w={130} h={40} radius={8} />
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[48, 64, 52, 80].map((w, i) => <Bone key={i} w={w} h={32} radius={20} />)}
      </div>

      {/* Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E5E5', overflow: 'hidden' }}>
        {/* Column headers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', padding: '12px 0', borderBottom: '1px solid #E5E5E5' }}>
          {[['30%', 10], ['14%', 10], ['12%', 10], ['8%', 10], ['20%', 10], ['10%', 10]].map(([w, h], i) => (
            <div key={i} style={{ width: w as string, padding: '0 16px' }}>
              <Bone w="60%" h={h as number} />
            </div>
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center',
              borderBottom: i < 4 ? '1px solid #E5E5E5' : 'none',
            }}
          >
            <div style={{ width: '30%', padding: '14px 16px' }}><Bone w="75%" h={14} /></div>
            <div style={{ width: '14%', padding: '14px 16px' }}><Bone w="60%" h={14} /></div>
            <div style={{ width: '12%', padding: '14px 16px' }}><Bone w="80%" h={14} /></div>
            <div style={{ width: '8%',  padding: '14px 16px' }}><Bone w={28} h={14} /></div>
            <div style={{ width: '20%', padding: '14px 16px' }}>
              <Bone w="100%" h={4} radius={2} />
              <div style={{ marginTop: '6px' }}><Bone w="50%" h={12} /></div>
            </div>
            <div style={{ width: '10%', padding: '14px 16px' }}><Bone w={56} h={22} radius={20} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}
