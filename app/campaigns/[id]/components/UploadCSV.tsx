'use client'

import { useState, useRef } from 'react'
import { checkDuplicates, insertProspects } from '../actions'

interface ParsedRow {
  full_name: string | null
  company: string | null
  industry: string | null
  email: string | null
}

type Stage = 'idle' | 'sf-confirm' | 'checking' | 'dupe-warning' | 'uploading' | 'done'

interface Props {
  campaignId: string
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
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

function mapRow(row: Record<string, string>): ParsedRow {
  const fullName =
    row['full name'] || row['full_name'] || row['name'] ||
    `${row['first name'] || row['first_name'] || ''} ${row['last name'] || row['last_name'] || ''}`.trim() ||
    null
  const email =
    row['email'] || row['email address'] || row['email_address'] || null
  const company =
    row['company'] || row['account name'] || row['account_name'] || row['organization'] || null
  const industry =
    row['industry'] || null

  return {
    full_name: fullName || null,
    company: company || null,
    industry: industry || null,
    email: email || null,
  }
}

export default function UploadCSV({ campaignId }: Props) {
  const [stage, setStage] = useState<Stage>('idle')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [sfChecked, setSfChecked] = useState(false)
  const [duplicateEmails, setDuplicateEmails] = useState<string[]>([])
  const [insertedCount, setInsertedCount] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const rows = parseCSV(text).map(mapRow).filter(r => r.email)
      setParsedRows(rows)
      setSfChecked(false)
      setStage('sf-confirm')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleConfirmSF() {
    if (!sfChecked) return
    setStage('checking')
    try {
      const emails = parsedRows.map(r => r.email!).filter(Boolean)
      const dupes = await checkDuplicates(campaignId, emails)
      setDuplicateEmails(dupes)
      if (dupes.length > 0) {
        setStage('dupe-warning')
      } else {
        await doInsert(parsedRows)
      }
    } catch {
      setStage('sf-confirm')
      alert('Error checking for duplicates. Please try again.')
    }
  }

  async function handleSkipAndContinue() {
    const dupeSet = new Set(duplicateEmails)
    const toInsert = parsedRows.filter(r => !r.email || !dupeSet.has(r.email))
    await doInsert(toInsert)
  }

  async function doInsert(rows: ParsedRow[]) {
    setStage('uploading')
    try {
      const result = await insertProspects(campaignId, rows)
      setInsertedCount(result.inserted)
      setStage('done')
    } catch {
      setStage('idle')
      alert('Upload failed. Please try again.')
    }
  }

  function reset() {
    setStage('idle')
    setParsedRows([])
    setSfChecked(false)
    setDuplicateEmails([])
    setInsertedCount(null)
  }

  const bannerStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
    borderRadius: '10px', padding: '20px 24px', marginBottom: '24px',
  }

  if (stage === 'idle' || stage === 'done') {
    return (
      <div>
        {stage === 'done' && insertedCount !== null && (
          <div style={{
            ...bannerStyle,
            backgroundColor: '#F0FDF4', borderColor: '#BBF7D0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <p style={{ fontSize: '14px', color: '#166534', margin: 0 }}>
              ✓ {insertedCount} contact{insertedCount !== 1 ? 's' : ''} uploaded successfully.
            </p>
            <button onClick={reset} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '13px', cursor: 'pointer' }}>
              Upload more
            </button>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            padding: '9px 16px', border: '1px solid #E5E5E5', borderRadius: '8px',
            backgroundColor: '#FFFFFF', color: '#0D0D0D', fontSize: '14px',
            fontWeight: '500', cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#E7534F')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E5E5')}
        >
          Upload CSV
        </button>
        <p style={{
          margin: '8px 0 0 0', fontSize: '11px', color: '#9CA3AF',
          lineHeight: '1.5', maxWidth: '300px',
        }}>
          Must include an <strong style={{ fontWeight: '600' }}>email</strong> column.
          Recommended: first name, last name (or full name), company, industry.
          Extra columns are ignored.
        </p>
      </div>
    )
  }

  if (stage === 'sf-confirm') {
    return (
      <div style={{ ...bannerStyle, backgroundColor: '#FFFBEB', borderColor: '#FDE68A', marginBottom: '24px' }}>
        <p style={{ fontSize: '14px', fontWeight: '600', color: '#92400E', marginBottom: '12px' }}>
          ⚠ Before uploading, confirm your SF export has been filtered to exclude contacts with &apos;Active Cycle&apos; checked.
        </p>
        <p style={{ fontSize: '13px', color: '#92400E', marginBottom: '16px' }}>
          {parsedRows.length} contact{parsedRows.length !== 1 ? 's' : ''} found in CSV
          {parsedRows.filter(r => !r.email).length > 0 ? ` (${parsedRows.filter(r => !r.email).length} rows skipped — no email)` : ''}.
        </p>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={sfChecked}
            onChange={e => setSfChecked(e.target.checked)}
            style={{ marginTop: '2px', accentColor: '#E7534F' }}
          />
          <span style={{ fontSize: '14px', color: '#0D0D0D' }}>
            I confirm the SF export has been filtered correctly and does not include Active Cycle contacts.
          </span>
        </label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleConfirmSF}
            disabled={!sfChecked}
            style={{
              padding: '8px 18px', border: 'none', borderRadius: '8px',
              backgroundColor: sfChecked ? '#E7534F' : '#F3A09F',
              color: '#FFFFFF', fontSize: '14px', fontWeight: '600',
              cursor: sfChecked ? 'pointer' : 'not-allowed',
            }}
          >
            Confirm &amp; Continue
          </button>
          <button
            onClick={reset}
            style={{
              padding: '8px 18px', border: '1px solid #E5E5E5', borderRadius: '8px',
              backgroundColor: '#FFFFFF', color: '#6B7280', fontSize: '14px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'checking' || stage === 'uploading') {
    return (
      <div style={{ ...bannerStyle, marginBottom: '24px', color: '#6B7280', fontSize: '14px' }}>
        {stage === 'checking' ? '🔍 Checking for duplicates…' : '⬆ Uploading contacts…'}
      </div>
    )
  }

  if (stage === 'dupe-warning') {
    return (
      <div style={{ ...bannerStyle, backgroundColor: '#FEF3C7', borderColor: '#FCD34D', marginBottom: '24px' }}>
        <p style={{ fontSize: '14px', fontWeight: '600', color: '#92400E', marginBottom: '8px' }}>
          {duplicateEmails.length} duplicate{duplicateEmails.length !== 1 ? 's' : ''} found
        </p>
        <p style={{ fontSize: '13px', color: '#78350F', marginBottom: '12px' }}>
          The following emails already exist in this campaign and will be skipped:
        </p>
        <ul style={{ margin: '0 0 16px 0', padding: '0 0 0 18px', maxHeight: '120px', overflowY: 'auto' }}>
          {duplicateEmails.map(e => (
            <li key={e} style={{ fontSize: '13px', color: '#78350F', marginBottom: '2px' }}>{e}</li>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSkipAndContinue}
            style={{
              padding: '8px 18px', border: 'none', borderRadius: '8px',
              backgroundColor: '#E7534F', color: '#FFFFFF', fontSize: '14px',
              fontWeight: '600', cursor: 'pointer',
            }}
          >
            Skip Duplicates &amp; Continue
          </button>
          <button
            onClick={reset}
            style={{
              padding: '8px 18px', border: '1px solid #E5E5E5', borderRadius: '8px',
              backgroundColor: '#FFFFFF', color: '#6B7280', fontSize: '14px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return null
}
