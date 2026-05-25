function Bone({ w, h, radius = 4 }: { w: number | string; h: number; radius?: number }) {
  return (
    <div
      className="animate-pulse"
      style={{ width: w, height: `${h}px`, backgroundColor: '#E5E5E5', borderRadius: `${radius}px`, flexShrink: 0 }}
    />
  )
}

export default function CampaignDetailLoading() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F6F3' }}>
      {/* Page header */}
      <div style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E5E5', padding: '24px 32px 0 32px' }}>
        <Bone w={110} h={13} radius={4} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '12px 0 20px' }}>
          <Bone w={260} h={22} radius={6} />
          <Bone w={56} h={22} radius={20} />
        </div>
        {/* Tab strip */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[80, 84, 76, 70].map((w, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                width: `${w}px`, height: '40px',
                backgroundColor: i === 0 ? '#F3F3F1' : '#FAFAFA',
                borderRadius: '4px 4px 0 0',
              }}
            />
          ))}
        </div>
      </div>

      {/* Tab content skeleton */}
      <div style={{ padding: '28px 32px' }}>
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '12px',
          border: '1px solid #E5E5E5', padding: '24px', marginBottom: '20px',
        }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ marginBottom: i < 3 ? '20px' : 0 }}>
              <Bone w={90} h={11} radius={3} />
              <div style={{ marginTop: '8px' }}>
                <Bone w={[220, 160, 200, 140][i]} h={14} />
              </div>
            </div>
          ))}
        </div>
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '12px',
          border: '1px solid #E5E5E5', padding: '24px',
        }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ marginBottom: i < 2 ? '16px' : 0 }}>
              <Bone w={[280, 200, 240][i]} h={14} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
