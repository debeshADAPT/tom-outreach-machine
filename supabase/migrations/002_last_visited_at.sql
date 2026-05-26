-- Run this in the Supabase SQL editor: https://app.supabase.com/project/fkhflhkfzvwpjoegypxy/sql
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS last_visited_at timestamptz;
