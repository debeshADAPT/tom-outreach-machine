'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Campaign, Prospect } from '@/lib/types'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { exportCampaignData } from '@/lib/export-utils'
import CampaignDetailsForm from './CampaignDetailsForm'
import ImportModal from './ImportModal'
import AssignRepsModal from './AssignRepsModal'

interface Props {
  campaign: Campaign
  isAdmin: boolean
}

function IconCog() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  )
}

interface DropdownPos { top: number; right: number }

function ProspectsDropdown({
  pos,
  campaignId,
  campaignName,
  onImport,
  onClose,
}: {
  pos: DropdownPos
  campaignId: string
  campaignName: string
  onImport: () => void
  onClose: () => void
}) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    onClose()
    setExporting(true)
    try {
      const supabase = createSupabaseBrowser()
      const { data } = await supabase
        .from('prospects')
        .select('*')
        .eq('campaign_id', campaignId)
      if (data) exportCampaignData(data as Prospect[], campaignName)
    } finally {
      setExporting(false)
    }
  }

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', fontSize: '14px', color: '#0D0D0D',
    cursor: 'pointer', whiteSpace: 'nowrap', background: 'none',
    border: 'none', width: '100%', textAlign: 'left',
  }

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: pos.top, right: pos.right,
        backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5',
        borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
        minWidth: '200px', zIndex: 100, padding: '4px 0', overflow: 'hidden',
      }}>
        {/* Add Prospects — visible to all assigned users */}
        <button
          style={itemStyle}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F7F6F3')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          onClick={() => { onClose(); onImport() }}
        >
          <span>↑</span> Add Prospects
        </button>
        <button
          style={{ ...itemStyle, opacity: exporting ? 0.6 : 1 }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F7F6F3')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          onClick={handleExport}
          disabled={exporting}
        >
          <span>↓</span> {exporting ? 'Exporting…' : 'Export Campaign Data'}
        </button>
      </div>
    </>,
    document.body
  )
}

export default function CampaignHeaderActions({ campaign, isAdmin }: Props) {
  const [cogOpen, setCogOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<DropdownPos>({ top: 0, right: 0 })
  const [importOpen, setImportOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [cogHovered, setCogHovered] = useState(false)
  const prospectsRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setCogOpen(false); setDropdownOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function openDropdown() {
    if (prospectsRef.current) {
      const rect = prospectsRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setDropdownOpen(true)
  }

  return (
    <>
      <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
        Last updated 2h ago 🔄
      </span>

      {/* Assign Reps button — admin only */}
      {isAdmin && (
        <button
          onClick={() => setAssignOpen(true)}
          style={{
            padding: '7px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: '500',
            border: '1px solid #E5E5E5', backgroundColor: '#FFFFFF', color: '#374151',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#9CA3AF' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E5E5' }}
        >
          👤 Assign Reps
        </button>
      )}

      {/* Cog button — admin only */}
      {isAdmin && (
        <button
          onClick={() => setCogOpen(true)}
          onMouseEnter={() => setCogHovered(true)}
          onMouseLeave={() => setCogHovered(false)}
          title="Campaign Settings"
          style={{
            width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '6px', border: '1px solid #E5E5E5',
            backgroundColor: '#FFFFFF', cursor: 'pointer',
            color: cogHovered ? '#E7534F' : '#6B7280',
            borderColor: cogHovered ? '#E7534F' : '#E5E5E5',
            transition: 'color 0.15s, border-color 0.15s',
            flexShrink: 0,
          }}
        >
          <IconCog />
        </button>
      )}

      {/* Prospects ▾ button — visible to all */}
      <button
        ref={prospectsRef}
        onClick={openDropdown}
        style={{
          padding: '7px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: '600',
          border: 'none', backgroundColor: '#E7534F', color: '#FFFFFF',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
        }}
      >
        Prospects ▾
      </button>

      {dropdownOpen && (
        <ProspectsDropdown
          pos={dropdownPos}
          campaignId={campaign.id}
          campaignName={campaign.name}
          onImport={() => setImportOpen(true)}
          onClose={() => setDropdownOpen(false)}
        />
      )}

      {importOpen && (
        <ImportModal campaignId={campaign.id} onClose={() => setImportOpen(false)} />
      )}

      {assignOpen && (
        <AssignRepsModal
          campaignId={campaign.id}
          onClose={() => setAssignOpen(false)}
        />
      )}

      {cogOpen && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 200 }}
            onClick={() => setCogOpen(false)}
          />
          <div
            style={{
              position: 'fixed', right: 0, top: 0, bottom: 0, width: '440px',
              backgroundColor: '#FFFFFF', zIndex: 201,
              boxShadow: '-4px 0 24px rgba(0,0,0,0.10)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px', borderBottom: '1px solid #E5E5E5', flexShrink: 0,
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#0D0D0D', margin: 0 }}>
                Campaign Settings
              </h2>
              <button
                onClick={() => setCogOpen(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '22px', color: '#9CA3AF', lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '30px', height: '30px',
                }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <CampaignDetailsForm campaign={campaign} isAdmin={isAdmin} />
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
