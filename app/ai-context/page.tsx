'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getAiContextProspects,
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
import { getEvents, type Event as SignalEvent } from '../events/actions'

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

// Parses full CSV preserving original-case headers so column mapping keys match row keys.
function parseCSVFull(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())
  const rows = lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').replace(/^"|"$/g, '').trim() })
    return row
  }).filter(row => Object.values(row).some(v => v))
  return { headers, rows }
}

type ColumnMapping = {
  firstName: string
  lastName: string
  company: string
  jobTitle: string
  linkedinUrl: string
}

function bestGuess(headers: string[]): ColumnMapping {
  const find = (keywords: string[]) =>
    headers.find(h => keywords.some(k => h.toLowerCase().includes(k))) ?? ''
  return {
    firstName: find(['first', 'fname', 'given']),
    lastName: find(['last', 'lname', 'surname', 'family']),
    company: find(['company', 'organization', 'org', 'employer', 'account']),
    jobTitle: find(['title', 'job', 'position', 'role']),
    linkedinUrl: find(['linkedin', 'li_url', 'li url', 'profile']),
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
        padding: '2px 7px', borderRadius: '2px', whiteSpace: 'nowrap',
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

function ConfidenceBadge({ score }: { score: number }) {
  const [color, bg, label] =
    score >= 4 ? ['#16A34A', '#F0FDF4', `Confidence ${score}/5`] :
    score >= 3 ? ['#D97706', '#FFFBEB', `Confidence ${score}/5`] :
                 ['#DC2626', '#FEF2F2', `Low confidence (${score}/5)`]
  return (
    <span style={{
      fontSize: '11px', fontWeight: '600', color, backgroundColor: bg,
      padding: '2px 8px', borderRadius: '2px', whiteSpace: 'nowrap',
    }}>
      {label}
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

// ─── Column mapping UI ────────────────────────────────────────────────────────

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: 'firstName',   label: 'First Name',   required: true },
  { key: 'lastName',    label: 'Last Name',     required: true },
  { key: 'company',     label: 'Company',       required: false },
  { key: 'jobTitle',    label: 'Job Title',     required: false },
  { key: 'linkedinUrl', label: 'LinkedIn URL',  required: false },
]

function ColumnMappingUI({
  fileName,
  headers,
  mapping,
  mappingError,
  onMappingChange,
  onConfirm,
  onCancel,
}: {
  fileName: string
  headers: string[]
  mapping: ColumnMapping
  mappingError: string | null
  onMappingChange: (field: keyof ColumnMapping, value: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#0D0D0D', marginBottom: '4px' }}>
        Map columns
      </div>
      <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {fileName}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        {MAPPING_FIELDS.map(({ key, label, required }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '110px', flexShrink: 0,
              fontSize: '12px', fontWeight: '500', color: '#374151',
            }}>
              {label}
              {required && <span style={{ color: '#E7534F', marginLeft: '2px' }}>*</span>}
            </div>
            <select
              value={mapping[key]}
              onChange={e => onMappingChange(key, e.target.value)}
              style={{
                flex: 1, padding: '5px 8px', border: '1px solid #E4E4E4',
                borderRadius: '2px', fontSize: '12px', color: '#374151',
                backgroundColor: '#FFFFFF', cursor: 'pointer',
              }}
            >
              <option value="">— Not mapped —</option>
              {headers.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {mappingError && (
        <p style={{ fontSize: '12px', color: '#DC2626', margin: '0 0 10px 0' }}>{mappingError}</p>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onConfirm}
          style={{
            flex: 1, padding: '7px 0', border: 'none', borderRadius: '2px',
            backgroundColor: '#E7534F', color: '#FFFFFF', fontSize: '13px',
            fontWeight: '500', cursor: 'pointer',
          }}
        >
          Confirm &amp; Import
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '7px 12px', border: '1px solid #E4E4E4', borderRadius: '2px',
            backgroundColor: '#FFFFFF', color: '#6B7280', fontSize: '13px', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type UploadStage = 'idle' | 'mapping' | 'uploading' | 'done'

export default function AiContextPage() {
  const [prospects, setProspects] = useState<AiContextProspect[]>([])
  const [events, setEvents] = useState<SignalEvent[]>([])
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

  const [bulkEventId, setBulkEventId] = useState('')
  const [rightEventId, setRightEventId] = useState('')

  // Upload state
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle')
  const [uploadCount, setUploadCount] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRawText, setCsvRawText] = useState<string>('')
  const [csvFileName, setCsvFileName] = useState<string>('')
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({ firstName: '', lastName: '', company: '', jobTitle: '', linkedinUrl: '' })
  const [mappingError, setMappingError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [researchError, setResearchError] = useState<string | null>(null)
  const [contextError, setContextError] = useState<string | null>(null)

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadProspects = useCallback(async () => {
    const data = await getAiContextProspects()
    setProspects(data)  // always replaces — never appends
  }, [])

  useEffect(() => {
    async function init() {
      const [p, e] = await Promise.all([getAiContextProspects(), getEvents()])
      setProspects(p)
      setEvents(e)
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

  // ── CSV upload — step 1: parse headers, enter mapping screen ─────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const { headers } = parseCSVFull(text)
      if (headers.length === 0) {
        setUploadError('Could not read headers from this CSV.')
        return
      }
      setCsvFileName(file.name)
      setCsvHeaders(headers)
      setCsvRawText(text)
      setColumnMapping(bestGuess(headers))
      setMappingError(null)
      setUploadError(null)
      setUploadStage('mapping')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleMappingChange(field: keyof ColumnMapping, value: string) {
    setColumnMapping(prev => ({ ...prev, [field]: value }))
  }

  // ── CSV upload — step 2: confirm mapping and insert ───────────────────────

  async function handleConfirmMapping() {
    if (!columnMapping.firstName || !columnMapping.lastName) {
      setMappingError('First Name and Last Name must be mapped before importing.')
      return
    }
    setMappingError(null)
    setUploadStage('uploading')

    const { rows: rawRows } = parseCSVFull(csvRawText)
    const rows = rawRows.map(raw => ({
      full_name: [raw[columnMapping.firstName], raw[columnMapping.lastName]].filter(Boolean).join(' ') || null,
      title: columnMapping.jobTitle ? (raw[columnMapping.jobTitle] || null) : null,
      company: columnMapping.company ? (raw[columnMapping.company] || null) : null,
      email: null,
      linkedin_url: columnMapping.linkedinUrl ? (raw[columnMapping.linkedinUrl] || null) : null,
    })).filter(r => r.full_name)

    if (rows.length === 0) {
      setUploadError('No valid rows found — First Name and Last Name columns appear empty.')
      setUploadStage('idle')
      return
    }

    const result = await insertAiContextProspects(rows)
    if (result.error) {
      setUploadError(result.error)
      setUploadStage('idle')
    } else {
      setUploadCount(result.inserted)
      setUploadStage('done')
      await loadProspects()  // replaces list — fixes duplicate-on-upload bug
    }
  }

  function resetUpload() {
    setUploadStage('idle')
    setUploadCount(null)
    setUploadError(null)
    setCsvHeaders([])
    setCsvRawText('')
    setCsvFileName('')
    setColumnMapping({ firstName: '', lastName: '', company: '', jobTitle: '', linkedinUrl: '' })
    setMappingError(null)
  }

  // ── Research (Phase 1) ────────────────────────────────────────────────────

  async function handleResearch(prospectId: string) {
    setResearchError(null)
    setResearchingIds(prev => new Set(prev).add(prospectId))
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
    setProspects(prev => prev.map(p => ids.includes(p.id) ? { ...p, intelligence_status: 'pending' } : p))
    await bulkRunIntelligence(ids)
    setBulkRunning(false)
    await loadProspects()
  }

  // ── Context generation (Phase 2) ──────────────────────────────────────────

  async function handleGenerateContext() {
    if (!activeId || !rightEventId) return
    setGeneratingContext(true)
    setContextError(null)
    const result = await generateContext(activeId, rightEventId)
    setGeneratingContext(false)
    if (!result.ok) {
      setContextError(result.error ?? 'Generation failed')
    } else if (result.context) {
      setContextHistory(prev => [result.context!, ...prev])
    }
  }

  async function handleBulkGenerateContext() {
    if (selectedIds.size === 0 || !bulkEventId) return
    setBulkGenerating(true)
    await bulkGenerateContext([...selectedIds], bulkEventId)
    setBulkGenerating(false)
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
      const h = await getProspectContextHistory(activeId!)
      setContextHistory(h)
    }
  }

  // ── Selection helpers ─────────────────────────────────────────────────────

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  function toggleAll() {
    setSelectedIds(selectedIds.size === prospects.length ? new Set() : new Set(prospects.map(p => p.id)))
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeProspect = prospects.find(p => p.id === activeId) ?? null
  const intel = activeProspect?.intelligence as ProspectIntelligence | null
  const canGenerateContext =
    activeProspect?.intelligence_status === 'complete' && !!rightEventId && !generatingContext
  const canBulkGenerate = selectedIds.size > 0 && !!bulkEventId && !bulkGenerating

  // ── Common styles ─────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    backgroundColor: '#FFFFFF', border: '1px solid #E4E4E4', borderRadius: '2px',
  }

  const btn = (variant: 'primary' | 'ghost' | 'danger', disabled?: boolean): React.CSSProperties => ({
    padding: '7px 14px', border: variant === 'ghost' ? '1px solid #E5E5E5' : 'none',
    borderRadius: '2px', fontSize: '13px', fontWeight: '500', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    backgroundColor: variant === 'primary' ? '#E7534F' : variant === 'danger' ? '#FEE2E2' : '#FFFFFF',
    color: variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? '#DC2626' : '#374151',
  })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ minHeight: '100vh', backgroundColor: '#F8F8F8' }}>
        {/* Page header */}
        <div style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E5E5', padding: '20px 32px' }}>
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
                {(uploadStage === 'done' || uploadStage === 'mapping') && (
                  <button onClick={resetUpload}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#9CA3AF' }}>
                    {uploadStage === 'done' ? 'Upload more' : 'Cancel'}
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
              ) : uploadStage === 'mapping' ? (
                <ColumnMappingUI
                  fileName={csvFileName}
                  headers={csvHeaders}
                  mapping={columnMapping}
                  mappingError={mappingError}
                  onMappingChange={handleMappingChange}
                  onConfirm={handleConfirmMapping}
                  onCancel={resetUpload}
                />
              ) : (
                <>
                  <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{
                      padding: '7px 14px', border: '1px solid #E4E4E4', borderRadius: '2px',
                      backgroundColor: '#FFFFFF', color: '#0D0D0D', fontSize: '13px',
                      fontWeight: '500', cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#E7534F')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
                  >
                    Upload CSV
                  </button>
                  <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '7px 0 0 0', lineHeight: '1.5' }}>
                    Any CSV — you&apos;ll map columns before importing.
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
                    value={bulkEventId}
                    onChange={e => setBulkEventId(e.target.value)}
                    style={{
                      flex: 1, padding: '7px 10px', border: '1px solid #E4E4E4',
                      borderRadius: '2px', fontSize: '13px', color: '#374151',
                      backgroundColor: '#FFFFFF', cursor: 'pointer',
                    }}
                  >
                    <option value="">Pick an event…</option>
                    {events.map(e => (
                      <option key={e.id} value={e.id}>{e.sf_identifier}</option>
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
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 16px', borderBottom: '1px solid #E5E5E5',
                    backgroundColor: '#F8F8F8',
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
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={e => { e.stopPropagation(); toggleSelected(p.id) }}
                          onClick={e => e.stopPropagation()}
                          style={{ accentColor: '#E7534F', cursor: 'pointer', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: '#0D0D0D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.full_name ?? '(no name)'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                            {[p.title, p.company].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <StatusBadge status={p.intelligence_status} />
                          <button
                            onClick={e => { e.stopPropagation(); handleResearch(p.id) }}
                            disabled={isResearching}
                            title="Run prospect research"
                            style={{
                              padding: '4px 10px', border: '1px solid #E4E4E4', borderRadius: '2px',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                      {[activeProspect.title, activeProspect.company].filter(Boolean).join(' · ')}
                    </p>
                    {activeProspect.linkedin_url && (
                      <a
                        href={activeProspect.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '11px', color: '#0077B5', textDecoration: 'none' }}
                      >
                        LinkedIn ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* INTELLIGENCE section */}
                <div style={{ ...card, padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0D0D0D', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Intelligence
                    </span>
                    <StatusBadge status={activeProspect.intelligence_status} />
                  </div>

                  {(!activeProspect.intelligence_status) && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <p style={{ fontSize: '14px', color: '#9CA3AF', margin: '0 0 12px 0' }}>
                        No research yet. Click &ldquo;Research&rdquo; on the left to populate this section.
                      </p>
                      <button onClick={() => handleResearch(activeProspect.id)} style={btn('primary')}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        {activeProspect.intelligence_updated_at && (
                          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                            Updated {new Date(activeProspect.intelligence_updated_at).toLocaleString('en-AU', {
                              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        )}
                        {intel.confidence_score != null && (
                          <ConfidenceBadge score={intel.confidence_score} />
                        )}
                      </div>
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

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px' }}>
                    <select
                      value={rightEventId}
                      onChange={e => setRightEventId(e.target.value)}
                      style={{
                        flex: 1, padding: '8px 12px', border: '1px solid #E4E4E4',
                        borderRadius: '2px', fontSize: '13px', color: '#374151',
                        backgroundColor: '#FFFFFF', cursor: 'pointer',
                      }}
                    >
                      <option value="">Select an event…</option>
                      {events.map(e => (
                        <option key={e.id} value={e.id}>{e.sf_identifier}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleGenerateContext}
                      disabled={!canGenerateContext}
                      style={btn('primary', !canGenerateContext)}
                      title={
                        activeProspect.intelligence_status !== 'complete' ? 'Run research first'
                          : !rightEventId ? 'Select an event' : undefined
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
                        <div key={ctx.id} style={{ border: '1px solid #E4E4E4', borderRadius: '2px', padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                            <span style={{
                              fontSize: '11px', fontWeight: '600', color: '#E7534F',
                              backgroundColor: '#FFF1F0', padding: '2px 8px', borderRadius: '2px',
                            }}>
                              {ctx.event_name}
                            </span>
                            <button
                              onClick={() => handleDeleteContext(ctx.id)}
                              disabled={deletingContextIds.has(ctx.id)}
                              title="Delete this context"
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: '#9CA3AF', fontSize: '16px', lineHeight: 1, padding: '0 2px', flexShrink: 0,
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
                            {ctx.profiles?.display_name && <span>by {ctx.profiles.display_name}</span>}
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
