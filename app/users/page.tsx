import { createSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getUsers } from './actions'
import UsersClient from './components/UsersClient'

export default async function UsersPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/campaigns')

  const users = await getUsers()

  return <UsersClient users={users} currentUserId={user.id} />
}
