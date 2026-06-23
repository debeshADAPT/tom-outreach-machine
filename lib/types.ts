export interface Campaign {
  id: string
  user_id: string
  name: string
  theme: string | null
  event_id: string | null
  event_date: string | null
  location: string | null
  event_brief: string | null
  status: 'draft' | 'active' | 'completed'
  created_at: string
  sequence_delays?: Record<string, number> | null
  email_templates?: Record<string, { subject: string; body: string }> | null
  last_visited_at?: string | null
}

export interface CampaignWithStats extends Campaign {
  totalProspects: number
  sentProspects: number
  assignedReps: { userId: string; displayName: string }[]
  eventTheme: string | null
}

export interface Prospect {
  id: string
  campaign_id: string
  assigned_to: string | null
  full_name: string | null
  company: string | null
  industry: string | null
  email: string | null
  title: string | null
  annual_revenue: string | null
  org_size: string | null
  history_tags: string[] | null
  sequence_step: string
  status: 'queued' | 'sent' | 'replied' | 'bounced' | 'declined'
  paused: boolean
  sent_at: string | null
  custom_emails: Record<string, { subject: string; body: string }> | null
  custom_delays: Record<string, number> | null
  created_at: string
}

export interface RepCampaignSettings {
  id: string
  campaign_id: string
  user_id: string
  sequence_delays: Record<string, number> | null
  email_templates: Record<string, { subject: string; body: string }> | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  role: 'admin' | 'staff'
  display_name: string | null
}
