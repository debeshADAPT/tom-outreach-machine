import { notFound, redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import type { Event, EventChangelogEntry, EventRep, TargetCompany } from '../actions'
import EventDetailClient from './components/EventDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'

  // Fetch event directly using the same client (mirrors campaigns/[id]/page.tsx)
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (!event) notFound()

  // Fetch changelog, assignments, and target companies in parallel
  const [{ data: changelogRaw }, { data: assignments }, { data: targetCompaniesRaw }] = await Promise.all([
    supabase
      .from('event_changelog')
      .select('*')
      .eq('event_id', id)
      .order('changed_at', { ascending: false }),
    supabase
      .from('campaign_assignments')
      .select('event_id, user_id, campaign_id')
      .eq('event_id', id),
    supabase
      .from('event_target_companies')
      .select('id, event_id, company_name, company_domain, created_at')
      .eq('event_id', id)
      .order('company_name', { ascending: true }),
  ])

  // Two-step join for rep display names (PostgREST can't traverse auth.users → profiles)
  const repUserIds = [...new Set((assignments ?? []).map((a: { user_id: string }) => a.user_id))]
  const { data: repProfiles } = repUserIds.length > 0
    ? await supabase.from('profiles').select('id, display_name').in('id', repUserIds)
    : { data: [] }
  const repProfilesMap = Object.fromEntries(
    (repProfiles ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name ?? null])
  )
  const assignedReps: EventRep[] = (assignments ?? []).map((a: { user_id: string; campaign_id: string | null }) => ({
    user_id: a.user_id,
    display_name: repProfilesMap[a.user_id] ?? null,
    campaign_id: a.campaign_id ?? null,
  }))

  // Two-step join for changelog author names
  const changelogUserIds = [...new Set(
    (changelogRaw ?? [])
      .map((c: { changed_by: string | null }) => c.changed_by)
      .filter((v): v is string => Boolean(v))
  )]
  const { data: changelogProfiles } = changelogUserIds.length > 0
    ? await supabase.from('profiles').select('id, display_name').in('id', changelogUserIds)
    : { data: [] }
  const changelogProfilesMap = Object.fromEntries(
    (changelogProfiles ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name ?? null])
  )
  const changelog: EventChangelogEntry[] = (changelogRaw ?? []).map((c: EventChangelogEntry) => ({
    ...c,
    profiles: c.changed_by ? { display_name: changelogProfilesMap[c.changed_by] ?? null } : undefined,
  }))

  // Target companies' owning reps (many-to-many junction)
  const targetCompanyIds = (targetCompaniesRaw ?? []).map((c: { id: string }) => c.id)
  const { data: companyReps } = targetCompanyIds.length > 0
    ? await supabase.from('event_target_company_reps').select('target_company_id, user_id').in('target_company_id', targetCompanyIds)
    : { data: [] }
  const ownersByCompany = new Map<string, string[]>()
  for (const r of companyReps ?? []) {
    const list = ownersByCompany.get(r.target_company_id) ?? []
    list.push(r.user_id)
    ownersByCompany.set(r.target_company_id, list)
  }
  const targetCompanies: TargetCompany[] = (targetCompaniesRaw ?? []).map((c: Omit<TargetCompany, 'ownerRepIds'>) => ({
    ...c,
    ownerRepIds: ownersByCompany.get(c.id) ?? [],
  }))

  const fullEvent: Event = { ...(event as Event), assignedReps }

  return (
    <EventDetailClient
      event={fullEvent}
      changelog={changelog}
      targetCompanies={targetCompanies}
      isAdmin={isAdmin}
    />
  )
}
