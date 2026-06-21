'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin, requireAuth } from '@/lib/require-admin'

export interface UserRecord {
  id: string
  display_name: string | null
  role: 'admin' | 'staff'
  email: string | null
  created_at: string
  status: 'active' | 'invited'
}

export async function getUsers(): Promise<UserRecord[]> {
  await requireAdmin()
  const supabase = await createSupabaseServer()
  const adminClient = createSupabaseAdmin()

  const [{ data: profiles }, { data: { users: authUsers } }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, role, created_at')
      .order('created_at', { ascending: true }),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const authMap = new Map(
    (authUsers ?? []).map(u => [u.id, { email: u.email ?? null, confirmed: !!u.email_confirmed_at }])
  )

  return (profiles ?? []).map(p => {
    const auth = authMap.get(p.id)
    return {
      id: p.id,
      display_name: p.display_name as string | null,
      role: (p.role ?? 'staff') as 'admin' | 'staff',
      email: auth?.email ?? null,
      created_at: p.created_at as string,
      status: auth?.confirmed ? 'active' : 'invited',
    }
  })
}

export async function inviteUser(
  fullName: string,
  email: string,
  role: 'admin' | 'staff'
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const adminClient = createSupabaseAdmin()

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  })

  if (error || !data?.user) {
    return { ok: false, error: error?.message ?? 'Invite failed' }
  }

  // Upsert profile — handles race with the handle_new_user trigger
  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert({ id: data.user.id, display_name: fullName, role }, { onConflict: 'id' })

  if (profileError) {
    return { ok: false, error: profileError.message }
  }

  return { ok: true }
}

export async function updateDisplayName(
  userId: string,
  displayName: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const trimmed = displayName.trim()
  if (!trimmed) return { ok: false, error: 'Display name cannot be empty' }
  // Use admin client to bypass RLS on profiles
  const adminClient = createSupabaseAdmin()
  const { error } = await adminClient
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function revokeUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const currentUserId = await requireAuth()
  if (currentUserId === userId) {
    return { ok: false, error: 'You cannot revoke your own access.' }
  }

  const adminClient = createSupabaseAdmin()
  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
