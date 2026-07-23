'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireAdmin, requireAuth } from '@/lib/require-admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventBrief {
  event_overview: string
  key_themes: string[]
  target_audience: string
  format_and_structure: string
  speakers: Array<{
    name: string
    title: string
    company: string
    topic: string
    photo_url: string
  }>
  agenda_highlights: string[]
  why_attend: string
}

export interface EventRep {
  user_id: string
  display_name: string | null
  campaign_id: string | null
}

// Lead Discovery Phase 3, part 1 — manager (admin) upload of an event's
// target company list, tagged with which rep(s) own each company.
export interface TargetCompany {
  id: string
  event_id: string
  company_name: string
  company_domain: string
  created_at: string
  ownerRepIds: string[]
}

export interface Event {
  id: string
  sf_identifier: string
  event_type: 'EDGE' | 'Roundtable'
  date: string
  location: string
  theme: string | null
  url_main: string | null
  url_speakers: string | null
  url_agenda: string | null
  brief: EventBrief | null
  brief_status: 'pending' | 'complete' | 'failed' | null
  brief_updated_at: string | null
  created_by: string | null
  created_at: string
  assignedReps?: EventRep[]
}

export interface EventChangelogEntry {
  id: string
  event_id: string
  changed_by: string | null
  changed_at: string
  change_type: string | null
  detail: Record<string, unknown> | null
  profiles?: { display_name: string | null }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchUrlContent(url: string): Promise<{ content: string; ok: boolean }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SIGNAL-Bot/1.0)' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return { content: '', ok: false }
    const text = await res.text()
    return { content: text.trim(), ok: text.trim().length > 0 }
  } catch {
    return { content: '', ok: false }
  }
}

// ─── HTML extraction helpers ──────────────────────────────────────────────────

function getMetaAttr(tag: string, attr: string): string | null {
  const m = tag.match(new RegExp(`\\b${attr}=["']([^"']*)["']`, 'i'))
  return m ? decodeEntities(m[1]) : null
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/gi, (_, n) => String.fromCharCode(+n))
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function extractStructuredContent(html: string): { meta: string; headings: string; body: string } {
  // ── Meta tags ──
  const metaLines: string[] = []
  const metaRegex = /<meta\s[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = metaRegex.exec(html)) !== null) {
    const tag = m[0]
    const property = getMetaAttr(tag, 'property')
    const name     = getMetaAttr(tag, 'name')
    const content  = getMetaAttr(tag, 'content')
    if (!content) continue
    if (property?.startsWith('og:')) {
      metaLines.push(`${property}: ${content}`)
    } else if (name?.toLowerCase() === 'description') {
      metaLines.push(`description: ${content}`)
    }
  }

  // ── Headings h1–h3 ──
  const headingLines: string[] = []
  const headingRegex = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi
  while ((m = headingRegex.exec(html)) !== null) {
    const text = stripTags(m[2])
    if (text.length > 2) headingLines.push(`H${m[1]}: ${text}`)
  }

  // ── Body: <p> tags + elements with relevant class names ──
  const bodyParts: string[] = []
  const seen = new Set<string>()

  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi
  while ((m = pRegex.exec(html)) !== null) {
    const text = stripTags(m[1])
    if (text.length > 15 && !seen.has(text)) { seen.add(text); bodyParts.push(text) }
  }

  // Elements whose class attribute contains any of these keywords
  const classRegex = /<([a-z][a-z0-9]*)\b[^>]*class=["'][^"']*(?:speaker|agenda|session|topic|bio)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi
  while ((m = classRegex.exec(html)) !== null) {
    const text = stripTags(m[2])
    if (text.length > 5 && !seen.has(text)) { seen.add(text); bodyParts.push(text) }
  }

  return {
    meta:     metaLines.join('\n')     || '(none found)',
    headings: headingLines.join('\n')  || '(none found)',
    body:     bodyParts.join('\n'),
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildBriefPrompt(event: Event, urlResults: Array<{ label: string; url: string; content: string; ok: boolean }>): string {
  const sections = urlResults.map(({ label, url, content, ok }) => {
    if (!ok || !content) {
      return `--- ${label} (${url}) ---\n[Could not fetch content from this URL — omit any details that would require this source]\n`
    }
    const { meta, headings, body } = extractStructuredContent(content)
    const bodyTruncated = body.length > 12000 ? body.slice(0, 12000) + '\n[content truncated]' : body
    return `--- ${label} (${url}) ---

--- Meta Tags ---
${meta}

--- Page Headings ---
${headings}

--- Page Content ---
${bodyTruncated}
`
  })

  return `You are extracting structured event intelligence from web page content.

Return ONLY valid JSON — no preamble, no markdown fences, no explanation. Just the JSON object.

Event: ${event.sf_identifier} (${event.event_type})

Web page content:
${sections.join('\n')}

Return this exact JSON structure with no extra keys:
{
  "event_overview": "2-3 sentence summary of what the event is and who it is for",
  "key_themes": ["theme 1", "theme 2", "theme 3"],
  "target_audience": "description of the ideal attendee",
  "format_and_structure": "how the day/session is structured",
  "speakers": [
    {
      "name": "Full Name",
      "title": "Job Title",
      "company": "Company Name",
      "topic": "What they are speaking about",
      "photo_url": "https://... or empty string if not found"
    }
  ],
  "agenda_highlights": ["highlight 1", "highlight 2"],
  "why_attend": "compelling reason to attend, 1-2 sentences"
}`
}

// ─── Scrape brief (internal) ──────────────────────────────────────────────────

async function runScrape(eventId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer()

  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (fetchError || !event) return { ok: false, error: 'Event not found' }

  const previousBrief = event.brief ?? null

  // Mark pending before any async work so the UI shows a spinner immediately
  await supabase
    .from('events')
    .update({ brief_status: 'pending' })
    .eq('id', eventId)

  // Archive the previous brief in changelog (fires even if scrape fails)
  await supabase.from('event_changelog').insert({
    event_id: eventId,
    changed_by: userId,
    change_type: 'brief_synced',
    detail: previousBrief ? { previous_brief: previousBrief } : null,
  })

  try {
    // Build list of URLs to fetch
    const urlTargets: Array<{ label: string; url: string }> = []
    if (event.url_main)     urlTargets.push({ label: 'Main Event',   url: event.url_main })
    if (event.url_speakers) urlTargets.push({ label: 'Speakers',     url: event.url_speakers })
    if (event.url_agenda)   urlTargets.push({ label: 'Agenda',       url: event.url_agenda })

    if (urlTargets.length === 0) throw new Error('No URLs to scrape')

    // Fetch all URLs (individual failures are noted gracefully, not fatal)
    const urlResults = await Promise.all(
      urlTargets.map(async ({ label, url }) => {
        const { content, ok } = await fetchUrlContent(url)
        return { label, url, content, ok }
      })
    )

    const prompt = buildBriefPrompt(event as Event, urlResults)

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude')

    const raw = textBlock.text.trim()
    const jsonStr = raw.startsWith('```')
      ? raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim()
      : raw
    const brief: EventBrief = JSON.parse(jsonStr)

    await supabase
      .from('events')
      .update({
        brief,
        brief_status: 'complete',
        brief_updated_at: new Date().toISOString(),
      })
      .eq('id', eventId)

    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[runScrape] failed for event ${eventId}:`, err)

    // Guarantee status is always reset — never left as pending.
    // Inner try/catch so a Supabase network blip here can't itself throw
    // and leave the event brief stuck polling forever.
    try {
      await supabase.from('events').update({ brief_status: 'failed' }).eq('id', eventId)
    } catch (resetErr) {
      console.error(`[runScrape] failed to reset brief_status for event ${eventId}:`, resetErr)
    }

    return { ok: false, error: message }
  }
}

// ─── Public actions ───────────────────────────────────────────────────────────

export async function createEvent(formData: FormData): Promise<{ ok: boolean; event?: Event; error?: string }> {
  await requireAdmin()
  const userId = await requireAuth()
  const supabase = await createSupabaseServer()

  const sfIdentifier = formData.get('sf_identifier') as string | null
  const eventType    = formData.get('event_type')    as string | null
  const date         = formData.get('date')          as string | null
  const location     = formData.get('location')      as string | null
  const theme        = (formData.get('theme')         as string | null) || null
  const urlMain      = (formData.get('url_main')      as string | null) || null
  const urlSpeakers  = (formData.get('url_speakers')  as string | null) || null
  const urlAgenda    = (formData.get('url_agenda')    as string | null) || null

  if (!sfIdentifier || !eventType || !date || !location) {
    return { ok: false, error: 'SF Identifier, event type, date, and location are required' }
  }

  const hasUrls = urlMain || urlSpeakers || urlAgenda

  const { data: inserted, error: insertError } = await supabase
    .from('events')
    .insert({
      sf_identifier: sfIdentifier,
      event_type:    eventType,
      date,
      location,
      theme,
      url_main:      urlMain,
      url_speakers:  urlSpeakers,
      url_agenda:    urlAgenda,
      created_by:    userId,
      ...(hasUrls ? { brief_status: 'pending' } : {}),
    })
    .select()
    .single()

  if (insertError || !inserted) {
    return { ok: false, error: insertError?.message ?? 'Insert failed' }
  }

  await supabase.from('event_changelog').insert({
    event_id:    inserted.id,
    changed_by:  userId,
    change_type: 'created',
    detail:      null,
  })

  // Kick off scraping if any URLs provided (fire and forget — UI polls brief_status)
  if (hasUrls) {
    runScrape(inserted.id, userId).catch(() => {})
  }

  return { ok: true, event: inserted as Event }
}

export async function scrapeEventBrief(eventId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const userId = await requireAuth()
  return runScrape(eventId, userId)
}

export async function resyncEventBrief(eventId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const userId = await requireAuth()
  return runScrape(eventId, userId)
}

export async function assignRepToEvent(
  eventId: string,
  userId: string
): Promise<{ ok: boolean; campaignId?: string; error?: string }> {
  await requireAdmin()
  const adminId = await requireAuth()
  const supabase = await createSupabaseServer()

  // Load event for name, date, location
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, sf_identifier, date, location')
    .eq('id', eventId)
    .single()

  if (eventError || !event) return { ok: false, error: 'Event not found' }

  // Auto-create a campaign for this rep linked to this event
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      name:       event.sf_identifier,  // explicitly the SF identifier per spec
      user_id:    userId,
      event_id:   eventId,
      event_date: event.date,
      location:   event.location,
      status:     'draft',
    })
    .select('id')
    .single()

  if (campaignError || !campaign) {
    return { ok: false, error: campaignError?.message ?? 'Failed to create campaign' }
  }

  // Insert into campaign_assignments linking event + user + their new campaign
  const { error: assignError } = await supabase
    .from('campaign_assignments')
    .insert({
      campaign_id: campaign.id,
      user_id:     userId,
      event_id:    eventId,
    })

  if (assignError) {
    // Roll back the campaign we just created
    await supabase.from('campaigns').delete().eq('id', campaign.id)
    return { ok: false, error: assignError.message }
  }

  await supabase.from('event_changelog').insert({
    event_id:    eventId,
    changed_by:  adminId,
    change_type: 'rep_assigned',
    detail:      { user_id: userId, campaign_id: campaign.id },
  })

  return { ok: true, campaignId: campaign.id }
}

export async function unassignRepFromEvent(
  eventId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const adminId = await requireAuth()
  const supabase = await createSupabaseServer()

  // Remove the event-level assignment (campaign stays orphaned — not deleted)
  const { error } = await supabase
    .from('campaign_assignments')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId)

  if (error) return { ok: false, error: error.message }

  await supabase.from('event_changelog').insert({
    event_id:    eventId,
    changed_by:  adminId,
    change_type: 'rep_unassigned',
    detail:      { user_id: userId },
  })

  return { ok: true }
}

export async function updateEvent(
  eventId: string,
  data: {
    sf_identifier?: string
    date?: string
    location?: string
    theme?: string | null
    url_main?: string | null
    url_speakers?: string | null
    url_agenda?: string | null
  }
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const supabase = await createSupabaseServer()

  const { error } = await supabase
    .from('events')
    .update(data)
    .eq('id', eventId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function getEvents(): Promise<Event[]> {
  await requireAuth()
  const supabase = await createSupabaseServer()

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true })

  if (!events || events.length === 0) return []

  const eventIds = events.map(e => e.id)

  const { data: assignments } = await supabase
    .from('campaign_assignments')
    .select('event_id, user_id, campaign_id')
    .in('event_id', eventIds)
    .not('event_id', 'is', null)

  const userIds = [...new Set((assignments ?? []).map(a => a.user_id))]
  const { data: profileRows } = userIds.length > 0
    ? await supabase.from('profiles').select('id, display_name').in('id', userIds)
    : { data: [] }

  const profilesMap = Object.fromEntries(
    (profileRows ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name ?? null])
  )

  const repsByEvent = new Map<string, EventRep[]>()
  for (const a of assignments ?? []) {
    if (!a.event_id) continue
    if (!repsByEvent.has(a.event_id)) repsByEvent.set(a.event_id, [])
    repsByEvent.get(a.event_id)!.push({
      user_id:      a.user_id,
      display_name: profilesMap[a.user_id] ?? null,
      campaign_id:  a.campaign_id,
    })
  }

  return events.map(e => ({
    ...(e as Event),
    assignedReps: repsByEvent.get(e.id) ?? [],
  }))
}

export async function getEventById(eventId: string): Promise<{
  event: Event | null
  changelog: EventChangelogEntry[]
}> {
  await requireAuth()
  const supabase = await createSupabaseServer()

  const [{ data: event }, { data: changelogRaw }, { data: assignments }] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).single(),
    supabase
      .from('event_changelog')
      .select('*')
      .eq('event_id', eventId)
      .order('changed_at', { ascending: false }),
    supabase
      .from('campaign_assignments')
      .select('event_id, user_id, campaign_id')
      .eq('event_id', eventId),
  ])

  if (!event) return { event: null, changelog: [] }

  // Two-step join for rep names (PostgREST cannot traverse auth.users → public.profiles)
  const repUserIds = [...new Set((assignments ?? []).map(a => a.user_id))]
  const { data: repProfiles } = repUserIds.length > 0
    ? await supabase.from('profiles').select('id, display_name').in('id', repUserIds)
    : { data: [] }

  const repProfilesMap = Object.fromEntries(
    (repProfiles ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name ?? null])
  )

  const assignedReps: EventRep[] = (assignments ?? []).map(a => ({
    user_id:      a.user_id,
    display_name: repProfilesMap[a.user_id] ?? null,
    campaign_id:  a.campaign_id,
  }))

  // Two-step join for changelog author names
  const changelogUserIds = [...new Set(
    (changelogRaw ?? []).map(c => c.changed_by as string).filter(Boolean)
  )]
  const { data: changelogProfiles } = changelogUserIds.length > 0
    ? await supabase.from('profiles').select('id, display_name').in('id', changelogUserIds)
    : { data: [] }

  const changelogProfilesMap = Object.fromEntries(
    (changelogProfiles ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name ?? null])
  )

  const changelog: EventChangelogEntry[] = (changelogRaw ?? []).map(c => ({
    ...(c as EventChangelogEntry),
    profiles: c.changed_by ? { display_name: changelogProfilesMap[c.changed_by as string] ?? null } : undefined,
  }))

  return {
    event:     { ...(event as Event), assignedReps },
    changelog,
  }
}

// ─── Target Companies (Lead Discovery Phase 3, part 1) ────────────────────────

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase()
}

export async function getTargetCompanies(eventId: string): Promise<TargetCompany[]> {
  await requireAuth()
  const supabase = await createSupabaseServer()

  const { data: companies } = await supabase
    .from('event_target_companies')
    .select('id, event_id, company_name, company_domain, created_at')
    .eq('event_id', eventId)
    .order('company_name', { ascending: true })

  if (!companies || companies.length === 0) return []

  const companyIds = companies.map(c => c.id)
  const { data: reps } = await supabase
    .from('event_target_company_reps')
    .select('target_company_id, user_id')
    .in('target_company_id', companyIds)

  const ownersByCompany = new Map<string, string[]>()
  for (const r of reps ?? []) {
    const list = ownersByCompany.get(r.target_company_id) ?? []
    list.push(r.user_id)
    ownersByCompany.set(r.target_company_id, list)
  }

  return companies.map(c => ({
    ...c,
    ownerRepIds: ownersByCompany.get(c.id) ?? [],
  }))
}

export async function uploadTargetCompanies(
  eventId: string,
  rows: Array<{ company_name: string; company_domain: string }>
): Promise<{ upserted: number; error?: string }> {
  await requireAdmin()
  const userId = await requireAuth()
  const supabase = await createSupabaseServer()

  const cleanRows = rows
    .map(r => ({
      event_id: eventId,
      company_name: r.company_name.trim(),
      company_domain: normalizeDomain(r.company_domain),
      created_by: userId,
    }))
    .filter(r => r.company_name && r.company_domain)

  if (cleanRows.length === 0) return { upserted: 0, error: 'No valid rows to import.' }

  // (event_id, company_domain) is a PLAIN unique index (015_event_target_companies.sql)
  // — not partial like 009/012/011 — so a normal upsert can target it directly.
  const { data, error } = await supabase
    .from('event_target_companies')
    .upsert(cleanRows, { onConflict: 'event_id,company_domain' })
    .select('id')

  if (error) return { upserted: 0, error: error.message }
  return { upserted: (data ?? []).length }
}

export async function setCompanyReps(
  targetCompanyId: string,
  userIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const supabase = await createSupabaseServer()

  const { error: delError } = await supabase
    .from('event_target_company_reps')
    .delete()
    .eq('target_company_id', targetCompanyId)
  if (delError) return { ok: false, error: delError.message }

  if (userIds.length === 0) return { ok: true }

  const { error: insError } = await supabase
    .from('event_target_company_reps')
    .insert(userIds.map(user_id => ({ target_company_id: targetCompanyId, user_id })))
  if (insError) return { ok: false, error: insError.message }

  return { ok: true }
}

export async function removeTargetCompany(targetCompanyId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const supabase = await createSupabaseServer()

  const { error } = await supabase
    .from('event_target_companies')
    .delete()
    .eq('id', targetCompanyId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
