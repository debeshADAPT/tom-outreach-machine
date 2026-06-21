import { notFound, redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getEventById } from '../actions'
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

  const { event, changelog } = await getEventById(id)
  if (!event) notFound()

  return <EventDetailClient event={event} changelog={changelog} isAdmin={isAdmin} />
}
