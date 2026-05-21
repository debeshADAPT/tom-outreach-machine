export interface Campaign {
  id: string
  user_id: string
  name: string
  theme: string | null
  event_date: string | null
  location: string | null
  event_brief: string | null
  status: 'draft' | 'active' | 'completed'
  created_at: string
}

export interface CampaignWithStats extends Campaign {
  totalProspects: number
  sentProspects: number
}

export interface Prospect {
  id: string
  campaign_id: string
  full_name: string | null
  company: string | null
  industry: string | null
  email: string | null
  history_tags: string[] | null
  sequence_step: string
  status: 'queued' | 'sent' | 'replied' | 'bounced' | 'unsubscribed'
  created_at: string
}
