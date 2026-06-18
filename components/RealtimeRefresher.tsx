'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

export function RealtimeRefresher({ tables }: { tables: string[] }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createSupabaseBrowser()
    const channel = supabase.channel('realtime-refresh')

    tables.forEach(table => {
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        () => router.refresh()
      )
    })

    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [router, tables])

  return null
}
