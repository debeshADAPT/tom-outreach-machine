-- campaigns table
create table if not exists campaigns (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  theme       text,
  event_date  date,
  location    text,
  event_brief text,
  status      text default 'draft' check (status in ('draft', 'active', 'completed')),
  created_at  timestamptz default now()
);

-- prospects table
create table if not exists prospects (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid references campaigns(id) on delete cascade not null,
  full_name     text,
  company       text,
  industry      text,
  email         text,
  history_tags  text[],
  sequence_step text default 'not_started',
  status        text default 'queued' check (status in ('queued', 'sent', 'replied', 'bounced', 'unsubscribed')),
  created_at    timestamptz default now()
);

-- Row Level Security
alter table campaigns enable row level security;
alter table prospects enable row level security;

-- campaigns policies
create policy "users_select_own_campaigns" on campaigns
  for select using (auth.uid() = user_id);

create policy "users_insert_own_campaigns" on campaigns
  for insert with check (auth.uid() = user_id);

create policy "users_update_own_campaigns" on campaigns
  for update using (auth.uid() = user_id);

create policy "users_delete_own_campaigns" on campaigns
  for delete using (auth.uid() = user_id);

-- prospects policies (via parent campaign ownership)
create policy "users_select_prospects" on prospects
  for select using (
    exists (
      select 1 from campaigns
      where campaigns.id = prospects.campaign_id
        and campaigns.user_id = auth.uid()
    )
  );

create policy "users_insert_prospects" on prospects
  for insert with check (
    exists (
      select 1 from campaigns
      where campaigns.id = prospects.campaign_id
        and campaigns.user_id = auth.uid()
    )
  );

create policy "users_update_prospects" on prospects
  for update using (
    exists (
      select 1 from campaigns
      where campaigns.id = prospects.campaign_id
        and campaigns.user_id = auth.uid()
    )
  );

create policy "users_delete_prospects" on prospects
  for delete using (
    exists (
      select 1 from campaigns
      where campaigns.id = prospects.campaign_id
        and campaigns.user_id = auth.uid()
    )
  );
