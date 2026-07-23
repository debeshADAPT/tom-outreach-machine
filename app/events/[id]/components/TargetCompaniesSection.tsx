'use client'

import { useRef, useState } from 'react'
import type { EventRep, TargetCompany } from '../../actions'
import { uploadTargetCompanies, setCompanyReps, removeTargetCompany, getTargetCompanies } from '../../actions'

// ─── CSV helpers (mirrors app/ai-context/page.tsx's parse/mapping pattern) ────

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

type ColumnMapping = { companyName: string; companyDomain: string }

function bestGuess(headers: string[]): ColumnMapping {
  const find = (keywords: string[]) =>
    headers.find(h => keywords.some(k => h.toLowerCase().includes(k))) ?? ''
  return {
    companyName: find(['company', 'account', 'organization', 'name']),
    companyDomain: find(['domain', 'website', 'url']),
  }
}

// ─── Small primitives ──────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: '#FFFFFF', border: '1px solid #E4E4E4', borderRadius: '2px',
  padding: '20px 24px', marginBottom: '16px',
}

function RepPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '2px',
        border: `1px solid ${active ? '#E7534F' : '#E4E4E4'}`,
        backgroundColor: active ? '#FEF2F2' : '#FFFFFF',
        color: active ? '#E7534F' : '#9CA3AF',
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// ─── Column mapping screen ──────────────────────────────────────────────────────

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: 'companyName', label: 'Company Name' },
  { key: 'companyDomain', label: 'Company Domain' },
]

function ColumnMappingUI({
  fileName, headers, mapping, mappingError, onMappingChange, onConfirm, onCancel,
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
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0D0D0D', marginBottom: '4px' }}>
        Map columns
      </div>
      <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {fileName}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        {MAPPING_FIELDS.map(({ key, label }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '130px', flexShrink: 0, fontSize: '12px', fontWeight: 500, color: '#374151' }}>
              {label}<span style={{ color: '#E7534F', marginLeft: '2px' }}>*</span>
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
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
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
            fontWeight: 500, cursor: 'pointer',
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

// ─── Main section ───────────────────────────────────────────────────────────────

type UploadStage = 'idle' | 'mapping' | 'uploading'

interface Props {
  eventId: string
  companies: TargetCompany[]
  eventReps: EventRep[]
  isAdmin: boolean
}

export default function TargetCompaniesSection({ eventId, companies: initialCompanies, eventReps, isAdmin }: Props) {
  const [companies, setCompanies] = useState<TargetCompany[]>(initialCompanies)
  const [pendingRepToggle, setPendingRepToggle] = useState<Set<string>>(new Set())
  const [removingId, setRemovingId] = useState<string | null>(null)

  const [uploadStage, setUploadStage] = useState<UploadStage>('idle')
  const [uploadCount, setUploadCount] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRawText, setCsvRawText] = useState('')
  const [csvFileName, setCsvFileName] = useState('')
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({ companyName: '', companyDomain: '' })
  const [mappingError, setMappingError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isAdmin) return null // Manager-managed only, same pattern as Assigned Reps

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

  async function handleConfirmMapping() {
    if (!columnMapping.companyName || !columnMapping.companyDomain) {
      setMappingError('Company Name and Company Domain must both be mapped before importing.')
      return
    }
    setMappingError(null)
    setUploadStage('uploading')

    const { rows: rawRows } = parseCSVFull(csvRawText)
    const rows = rawRows
      .map(raw => ({
        company_name: raw[columnMapping.companyName] || '',
        company_domain: raw[columnMapping.companyDomain] || '',
      }))
      .filter(r => r.company_name && r.company_domain)

    if (rows.length === 0) {
      setUploadError('No valid rows found — Company Name and Company Domain columns appear empty.')
      setUploadStage('idle')
      return
    }

    const result = await uploadTargetCompanies(eventId, rows)
    if (result.error) {
      setUploadError(result.error)
      setUploadStage('idle')
    } else {
      setUploadCount(result.upserted)
      setUploadStage('idle')
      setCompanies(await getTargetCompanies(eventId))
    }
  }

  function resetUpload() {
    setUploadStage('idle')
    setUploadCount(null)
    setUploadError(null)
    setCsvHeaders([])
    setCsvRawText('')
    setCsvFileName('')
    setColumnMapping({ companyName: '', companyDomain: '' })
    setMappingError(null)
  }

  async function toggleRep(companyId: string, repUserId: string) {
    if (pendingRepToggle.has(companyId)) return
    setPendingRepToggle(prev => new Set(prev).add(companyId))

    const company = companies.find(c => c.id === companyId)
    if (!company) return
    const wasOwner = company.ownerRepIds.includes(repUserId)
    const nextOwnerIds = wasOwner
      ? company.ownerRepIds.filter(id => id !== repUserId)
      : [...company.ownerRepIds, repUserId]

    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, ownerRepIds: nextOwnerIds } : c))

    const result = await setCompanyReps(companyId, nextOwnerIds)
    if (!result.ok) {
      // Revert on error
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, ownerRepIds: company.ownerRepIds } : c))
    }
    setPendingRepToggle(prev => { const n = new Set(prev); n.delete(companyId); return n })
  }

  async function handleRemove(companyId: string) {
    setRemovingId(companyId)
    const result = await removeTargetCompany(companyId)
    if (result.ok) {
      setCompanies(prev => prev.filter(c => c.id !== companyId))
    }
    setRemovingId(null)
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Target Companies
        </div>
        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{companies.length} companies</span>
      </div>

      {uploadStage === 'idle' && (
        <>
          {uploadCount !== null && (
            <div style={{
              backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '2px',
              padding: '10px 14px', marginBottom: '12px', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between',
            }}>
              <p style={{ fontSize: '13px', color: '#166534', margin: 0 }}>
                ✓ {uploadCount} compan{uploadCount !== 1 ? 'ies' : 'y'} imported.
              </p>
              <button onClick={resetUpload} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '12px', cursor: 'pointer' }}>
                Upload more
              </button>
            </div>
          )}
          {uploadError && (
            <p style={{ fontSize: '12px', color: '#DC2626', marginBottom: '10px' }}>{uploadError}</p>
          )}
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              padding: '6px 14px', border: '1px solid #E4E4E4', borderRadius: '2px',
              backgroundColor: '#FFFFFF', color: '#374151', fontSize: '12px',
              fontWeight: 500, cursor: 'pointer', marginBottom: '16px',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#E7534F')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#E4E4E4')}
          >
            Upload CSV
          </button>
        </>
      )}

      {uploadStage === 'mapping' && (
        <ColumnMappingUI
          fileName={csvFileName}
          headers={csvHeaders}
          mapping={columnMapping}
          mappingError={mappingError}
          onMappingChange={(field, value) => setColumnMapping(prev => ({ ...prev, [field]: value }))}
          onConfirm={handleConfirmMapping}
          onCancel={resetUpload}
        />
      )}

      {uploadStage === 'uploading' && (
        <p style={{ fontSize: '13px', color: '#6B7280' }}>Uploading companies…</p>
      )}

      {companies.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
          No target companies yet. Upload a CSV to get started.
        </p>
      ) : (
        <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E4E4E4' }}>
                <th style={{ textAlign: 'left', fontSize: '11px', color: '#9CA3AF', padding: '6px 8px 6px 0', fontWeight: 600 }}>Company</th>
                <th style={{ textAlign: 'left', fontSize: '11px', color: '#9CA3AF', padding: '6px 8px', fontWeight: 600 }}>Domain</th>
                <th style={{ textAlign: 'left', fontSize: '11px', color: '#9CA3AF', padding: '6px 8px', fontWeight: 600 }}>Owning Rep(s)</th>
                <th style={{ width: '32px' }} />
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '8px 8px 8px 0', fontSize: '13px', color: '#0D0D0D', fontWeight: 500 }}>{c.company_name}</td>
                  <td style={{ padding: '8px', fontSize: '12px', color: '#6B7280' }}>{c.company_domain}</td>
                  <td style={{ padding: '8px' }}>
                    {eventReps.length === 0 ? (
                      <span style={{ fontSize: '11px', color: '#D1D5DB' }}>No reps assigned to event</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {eventReps.map(rep => (
                          <RepPill
                            key={rep.user_id}
                            label={rep.display_name ?? '(no name)'}
                            active={c.ownerRepIds.includes(rep.user_id)}
                            onClick={() => toggleRep(c.id, rep.user_id)}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleRemove(c.id)}
                      disabled={removingId === c.id}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '16px', color: '#D1D5DB', lineHeight: 1,
                        opacity: removingId === c.id ? 0.5 : 1,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
