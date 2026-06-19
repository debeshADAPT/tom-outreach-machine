'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getAiContextProspects,
  getLiveCampaigns,
  runProspectIntelligence,
  generateContext,
  bulkRunIntelligence,
  bulkGenerateContext,
  getProspectContextHistory,
  deleteContext,
  insertAiContextProspects,
  type AiContextProspect,
  type ProspectContext,
  type ProspectIntelligence,
} from './actions'

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').replace(/^"|"$/g, '').trim() })
    return row
  }).filter(row => Object.values(row).some(v => v))
}

function mapCSVRow(row: Record<string, string>) {
  const fname = row['fname'] || row['first_name'] || row['first name'] || ''
  const lname = row['lname'] || row['last_name'] || row['last name'] || ''
  const fullName =
    row['full_name'] || row['full name'] || row['name'] ||
    [fname, lname].filter(Boolean).join(' ') || null
  return {
    full_name: fullName || null,
    title: row['job_title'] || row['title'] || row['job title'] || null,
    company: row['company'] || row['organization'] || null,
    email: row['email'] || null,
  }
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      border: `2px solid #E5E5E5`, borderTop: `2px solid #9CA3AF`,
      animation: 'spin 0.75s linear infinite', flexShrink: 0,
    }} />
  )
}

function StatusBadge({ status }: { status: AiContextProspect['intelligence_status'] }) {
  if (!status) {
    return (
      <span style={{
        fontSize: '11px', color: '#9CA3AF', backgroundColor: '#F3F4F6',
        padding: '2px 7px', borderRadius: '10px', whiteSpace: 'nowrap',
      }}>
        No research
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#6B7280', whiteSpace: 'nowrap' }}>
        <Spinner size={10} />
        Researching
      </span>
    )
  }
  if (status === 'complete') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#16A34A', whiteSpace: 'nowrap' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#16A34A', display: 'inline-block', flexShrink: 0 }} />
        Ready
      </span>
    )
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#DC2626', whiteSpace: 'nowrap' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#DC2626', display: 'inline-block', flexShrink: 0 }} />
      Failed
    </span>
  )
}

function IntelligenceField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.55' }}>
        {value || <span style={{ color: '#9CA3AF' }}>—</span>}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Campaign = { id: string; name: string; theme: string | null; status: string }

export default function AiContextPage() {
  const [prospects, setProspects] = useState<AiContextProspect[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [contextHistory, setContextHistory] = useState<ProspectContext[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [researchingIds, setResearchingIds] = useState<Set<string>>(new Set())
  const [generatingContext, setGeneratingContext] = useState(false)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [deletingContextIds, setDeletingContextIds] = useState<Set<string>>(new Set())

  const [bulkCampaignId, setBulkCampaignId] = useState('')
  const [rightCampaignId, setRightCampaignId] = useState('')

  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [uploadCount, setUploadCount] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [researchError, setResearchError] = useState<string | null>(null)
  const [contextError, setContextError] = useState<string | null>(null)

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadProspects = useCallback(async () => {
    const data = await getAiContextProspects()
    setProspects(data)
  }, [])

  useEffect(() => {
    async function init() {
      const [p, c] = await Promise.all([getAiContextProspects(), getLiveCampaigns()])
      setProspects(p)
      setCampaigns(c)
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (!activeId) { setContextHistory([]); return }
    setLoadingHistory(true)
    getProspectContextHistory(activeId).then(h => {
      setContextHistory(h)
      setLoadingHistory(false)
    })
  }, [activeId])

  // ── CSV upload ────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const text = ev.target?.result as string
      const rows = parseCSV(text).map(mapCSVRow).filter(r => r.full_name || r.company)
      if (rows.length === 0) {
        setUploadError('No valid rows found. CSV must have fname/lname (or full_name) columns.')
        return
      }
      setUploadStage('uploading')
      setUploadError(null)
      const result = await insertAiContextProspects(rows)
      if (result.error) {
        setUploadError(result.error)
        setUploadStage('idle')
      } else {
        setUploadCount(result.inserted)
        setUploadStage('done')
        await loadProspects()
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Research (Phase 1) ────────────────────────────────────────────────────

  async function handleResearch(prospectId: string) {
    setResearchError(null)
    setResearchingIds(prev => new Set(prev).add(prospectId))
    // optimistic pending
    setProspects(prev => prev.map(p => p.id === prospectId ? { ...p, intelligence_status: 'pending' } : p))

    const result = await runProspectIntelligence(prospectId)
    setResearchingIds(prev => { const s = new Set(prev); s.delete(prospectId); return s })

    if (!result.ok) setResearchError(result.error ?? 'Research failed')
    await loadProspects()
  }

  async function handleBulkResearch() {
    if (selectedIds.size === 0) return
    setBulkRunning(true)
    setResearchError(null)
    const ids = [...selectedIds]
    // optimistic pending for all
    setProspects(prev => prev.map(p => ids.includes(p.id) ? { ...p, intelligence_status: 'pending' } : p))
    await bulkRunIntelligence(ids)
    setBulkRunning(false)
    await loadProspects()
  }

  // ── Context generation (Phase 2) ──────────────────────────────────────────

  async function handleGenerateContext() {
    if (!activeId || !rightCampaignId) return
    setGeneratingContext(true)
    setContextError(null)
    const result = await generateContext(activeId, rightCampaignId)
    setGeneratingContext(false)
    if (!result.ok) {
      setContextError(result.error ?? 'Generation failed')
    } else if (result.context) {
      setContextHistory(prev => [result.context!, ...prev])
    }
  }

  async function handleBulkGenerateContext() {
    if (selectedIds.size === 0 || !bulkCampaignId) return
    setBulkGenerating(true)
    await bulkGenerateContext([...selectedIds], bulkCampaignId)
    setBulkGenerating(false)
    // Re-load history if active prospect is in the selection
    if (activeId && selectedIds.has(activeId)) {
      const h = await getProspectContextHistory(activeId)
      setContextHistory(h)
    }
  }

  async function handleDeleteContext(contextId: string) {
    setDeletingContextIds(prev => new Set(prev).add(contextId))
    setContextHistory(prev => prev.filter(c => c.id !== contextId))
    const result = await deleteContext(contextId)
    setDeletingContextIds(prev => { const s = new Set(prev); s.delete(contextId); return s })
    if (!result.ok) {
      // revert on failure
      const h = await getProspectContextHistory(activeId!)
      setContextHistory(h)
    }
  }

  // ── Selection helpers ─────────────────────────────────────────────────────

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  function toggleAll() {
    if (selectedIds.size === prospects.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(prospects.map(p => p.id)))
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeProspect = prospects.find(p => p.id === activeId) ?? null
  const intel = activeProspect?.intelligence as ProspectIntelligence | null
  const canGenerateContext =
    activeProspect?.intelligence_status === 'complete' && !!rightCampaignId && !generatingContext
  const canBulkGenerate = selectedIds.size > 0 && !!bulkCampaignId && !bulkGenerating

  // ── Common styles ─────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: '10px',
  }

  const btn = (variant: 'primary' | 'ghost' | 'danger', disabled?: boolean): React.CSSProperties => ({
    padding: '7px 14px', border: variant === 'ghost' ? '1px solid #E5E5E5' : 'none',
    borderRadius: '7px', fontSize: '13px', fontWeight: '500', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    backgroundColor: variant === 'primary' ? '#E7534F' : variant === 'danger' ? '#FEE2E2' : '#FFFFFF',
    color: variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? '#DC2626' : '#374151',
  })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ minHeight: '100vh', backgroundColor: '#F7F6F3' }}>
        {/* Page header */}
        <div style={{
          backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E5E5',
          padding: '20px 32px',
        }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#0D0D0D', margin: 0 }}>
            AI Context Creator
          </h1>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0 0' }}>
            Research prospects and generate tailored event context.
          </p>
        </div>

        <div style={{ padding: '24px 32px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

          {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
          <div style={{ width: '420px', minWidth: '380px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* CSV Upload card */}
            <div style={{ ...card, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#0D0D0D' }}>Add Prospects</span>
                {uploadStage === 'done' && (
                  <button onClick={() => { setUploadStage('idle'); setUploadCount(null) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#9CA3AF' }}>
                    Upload more
                  </button>
                )}
              </div>

              {uploadStage === 'done' && uploadCount !== null ? (
                <div style={{ fontSize: '13px', color: '#16A34A' }}>
                  ✓ {uploadCount} prospect{uploadCount !== 1 ? 's' : ''} added.
                </div>
              ) : uploadStage === 'uploading' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6B7280' }}>
                  <Spinner /> Uploading…
                </div>
              ) : (
                <>
                  <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{
                      padding: '7px 14px', border: '1px solid #E5E5E5', borderRadius: '7px',
                      backgroundColor: '#FFFFFF', color: '#0D0D0D', fontSize: '13px',
                      fontWeight: '500', cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#E7534F')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
                  >
                    Upload CSV
                  </button>
                  <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '7px 0 0 0', lineHeight: '1.5' }}>
                    Columns: <strong style={{ fontWeight: '600', color: '#6B7280' }}>fname, lname, job_title, company</strong>
                  </p>
                </>
              )}
              {uploadError && (
                <p style={{ fontSize: '12px', color: '#DC2626', margin: '8px 0 0 0' }}>{uploadError}</p>
              )}
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div style={{
                ...card, padding: '12px 16px',
                backgroundColor: '#FFF8F7', borderColor: '#FECACA',
                display: 'flex', flexDirection: 'column', gap: '10px',
              }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#E7534F' }}>
                  {selectedIds.size} selected
                </div>
                <button
                  onClick={handleBulkResearch}
                  disabled={bulkRunning || bulkGenerating}
                  style={btn('primary', bulkRunning || bulkGenerating)}
                >
                  {bulkRunning ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <Spinner size={12} /> Researching…
                    </span>
                  ) : 'Research Selected'}
                </button>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value={bulkCampaignId}
                    onChange={e => setBulkCampaignId(e.target.value)}
                    style={{
                      flex: 1, padding: '7px 10px', border: '1px solid #E5E5E5',
                      borderRadius: '7px', fontSize: '13px', color: '#374151',
                      backgroundColor: '#FFFFFF', cursor: 'pointer',
                    }}
                  >
                    <option value="">Pick a campaign…</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkGenerateContext}
                    disabled={!canBulkGenerate}
                    style={btn('primary', !canBulkGenerate)}
                  >
                    {bulkGenerating ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <Spinner size={12} /> Generating…
                      </span>
                    ) : 'Generate Context'}
                  </button>
                </div>
              </div>
            )}

            {/* Prospect list */}
            <div style={{ ...card, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '32px', display: 'flex', justifyContent: 'center' }}>
                  <Spinner size={20} />
                </div>
              ) : prospects.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>
                    No prospects yet. Upload a CSV to get started.
                  </p>
                </div>
              ) : (
                <>
                  {/* Header row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 16px', borderBottom: '1px solid #E5E5E5',
                    backgroundColor: '#F9F9F8',
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === prospects.length && prospects.length > 0}
                      onChange={toggleAll}
                      style={{ accentColor: '#E7534F', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {prospects.length} prospect{prospects.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Rows */}
                  {prospects.map((p, i) => {
                    const isActive = p.id === activeId
                    const isResearching = researchingIds.has(p.id) || p.intelligence_status === 'pending'
                    return (
                      <div
                        key={p.id}
                        onClick={() => setActiveId(p.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '12px 16px',
                          borderBottom: i < prospects.length - 1 ? '1px solid #F3F3F1' : 'none',
                          backgroundColor: isActive ? '#FFF8F7' : 'transparent',
                          cursor: 'pointer', transition: 'background-color 0.1s',
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#F9F9F8' }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={e => { e.stopPropagation(); toggleSelected(p.id) }}
                          onClick={e => e.stopPropagation()}
                          style={{ accentColor: '#E7534F', cursor: 'pointer', flexShrink: 0 }}
                        />

                        {/* Identity */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '13px', fontWeight: '500', color: '#0D0D0D',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {p.full_name ?? '(no name)'}
                          </div>
                          <div style={{
                            fontSize: '12px', color: '#6B7280',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            marginTop: '1px',
                          }}>
                            {[p.title, p.company].filter(Boolean).join(' · ')}
                          </div>
                        </div>

                        {/* Status + Research button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <StatusBadge status={p.intelligence_status} />
                          <button
                            onClick={e => { e.stopPropagation(); handleResearch(p.id) }}
                            disabled={isResearching}
                            title="Run prospect research"
                            style={{
                              padding: '4px 10px', border: '1px solid #E5E5E5', borderRadius: '6px',
                              backgroundColor: '#FFFFFF', color: '#374151', fontSize: '12px',
                              cursor: isResearching ? 'not-allowed' : 'pointer',
                              opacity: isResearching ? 0.5 : 1, flexShrink: 0,
                            }}
                            onMouseEnter={e => { if (!isResearching) e.currentTarget.style.borderColor = '#E7534F' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E5E5' }}
                          >
                            {isResearching ? <Spinner size={11} /> : 'Research'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>

            {researchError && (
              <p style={{ fontSize: '12px', color: '#DC2626', margin: 0 }}>{researchError}</p>
            )}
          </div>

          {/* ── RIGHT PANEL ────────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {!activeProspect ? (
              <div style={{
                ...card, padding: '48px 32px', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '4px' }}>✦</div>
                <p style={{ fontSize: '15px', fontWeight: '600', color: '#0D0D0D', margin: 0 }}>
                  Select a prospect
                </p>
                <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
                  Click any row to view intelligence and generate context.
                </p>
              </div>
            ) : (
              <>
                {/* Prospect name header */}
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0D0D0D', margin: '0 0 2px 0' }}>
                    {activeProspect.full_name ?? '(no name)'}
                  </h2>
                  <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                    {[activeProspect.title, activeProspect.company].filter(Boolean).join(' · ')}
                  </p>
                </div>

                {/* INTELLIGENCE section */}
                <div style={{ ...card, padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0D0D0D', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Intelligence
                    </span>
                    <StatusBadge status={activeProspect.intelligence_status} />
                  </div>

                  {(!activeProspect.intelligence_status || activeProspect.intelligence_status === null) && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <p style={{ fontSize: '14px', color: '#9CA3AF', margin: '0 0 12px 0' }}>
                        No research yet. Click &ldquo;Research&rdquo; on the left to populate this section.
                      </p>
                      <button
                        onClick={() => handleResearch(activeProspect.id)}
                        style={btn('primary')}
                      >
                        Run Research
                      </button>
                    </div>
                  )}

                  {activeProspect.intelligence_status === 'pending' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', color: '#6B7280', fontSize: '13px' }}>
                      <Spinner size={16} />
                      Claude is researching this person — this may take 20–40 seconds…
                    </div>
                  )}

                  {activeProspect.intelligence_status === 'failed' && (
                    <div style={{ padding: '12px 0' }}>
                      <p style={{ fontSize: '14px', color: '#DC2626', margin: '0 0 12px 0' }}>
                        Research failed. Previous data (if any) is preserved.
                      </p>
                      <button
                        onClick={() => handleResearch(activeProspect.id)}
                        disabled={researchingIds.has(activeProspect.id)}
                        style={btn('primary', researchingIds.has(activeProspect.id))}
                      >
                        Retry Research
                      </button>
                    </div>
                  )}

                  {activeProspect.intelligence_status === 'complete' && intel && (
                    <div>
                      {activeProspect.intelligence_updated_at && (
                        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '0 0 16px 0' }}>
                          Last updated {new Date(activeProspect.intelligence_updated_at).toLocaleString('en-AU', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      )}
                      <IntelligenceField label="Career summary" value={intel.career_summary} />
                      <IntelligenceField label="Current responsibilities" value={intel.current_responsibilities} />
                      <IntelligenceField label="Recent activity" value={intel.recent_activity} />
                      <IntelligenceField label="Company context" value={intel.company_context} />
                      <IntelligenceField label="Public presence" value={intel.public_presence} />
                      <IntelligenceField label="Potential pain points" value={intel.potential_pain_points} />
                      <IntelligenceField label="Notable achievements" value={intel.notable_achievements} />
                    </div>
                  )}
                </div>

                {/* CONTEXT HISTORY section */}
                <div style={{ ...card, padding: '20px 24px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0D0D0D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
                    Context History
                  </div>

                  {/* Generate row */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px' }}>
                    <select
                      value={rightCampaignId}
                      onChange={e => setRightCampaignId(e.target.value)}
                      style={{
                        flex: 1, padding: '8px 12px', border: '1px solid #E5E5E5',
                        borderRadius: '8px', fontSize: '13px', color: '#374151',
                        backgroundColor: '#FFFFFF', cursor: 'pointer',
                      }}
                    >
                      <option value="">Select an event…</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleGenerateContext}
                      disabled={!canGenerateContext}
                      style={btn('primary', !canGenerateContext)}
                      title={
                        !activeProspect.intelligence || activeProspect.intelligence_status !== 'complete'
                          ? 'Run research first'
                          : !rightCampaignId ? 'Select a campaign' : undefined
                      }
                    >
                      {generatingContext ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <Spinner size={12} /> Generating…
                        </span>
                      ) : 'Generate Context'}
                    </button>
                  </div>

                  {contextError && (
                    <p style={{ fontSize: '12px', color: '#DC2626', margin: '0 0 14px 0' }}>{contextError}</p>
                  )}

                  {/* History list */}
                  {loadingHistory ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                      <Spinner size={16} />
                    </div>
                  ) : contextHistory.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
                      No context generated yet. Select an event above and click Generate.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {contextHistory.map(ctx => (
                        <div key={ctx.id} style={{
                          border: '1px solid #E5E5E5', borderRadius: '8px', padding: '14px 16px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{
                                fontSize: '11px', fontWeight: '600', color: '#E7534F',
                                backgroundColor: '#FFF1F0', padding: '2px 8px', borderRadius: '10px',
                              }}>
                                {ctx.event_name}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteContext(ctx.id)}
                              disabled={deletingContextIds.has(ctx.id)}
                              title="Delete this context"
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: '#9CA3AF', fontSize: '16px', lineHeight: 1, padding: '0 2px',
                                flexShrink: 0,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                            >
                              ×
                            </button>
                          </div>
                          <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6', margin: '0 0 10px 0' }}>
                            {ctx.context_lines}
                          </p>
                          <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#9CA3AF' }}>
                            {ctx.profiles?.display_name && (
                              <span>by {ctx.profiles.display_name}</span>
                            )}
                            <span>
                              {new Date(ctx.created_at).toLocaleString('en-AU', {
                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
