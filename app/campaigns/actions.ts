'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { refresh } from 'next/cache'

export async function createCampaign(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const name = (formData.get('name') as string ?? '').trim()
  if (!name) throw new Error('Campaign name is required')

  const { error } = await supabase.from('campaigns').insert({
    user_id: user.id,
    name,
    theme: (formData.get('theme') as string) || null,
    event_date: (formData.get('event_date') as string) || null,
    location: (formData.get('location') as string) || null,
    status: 'draft',
  })

  if (error) throw error
  refresh()
}
