export default function EdgePage() {
  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <iframe
        src="/edge/index.html"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="ADAPT Edge"
      />
    </div>
  )
}
