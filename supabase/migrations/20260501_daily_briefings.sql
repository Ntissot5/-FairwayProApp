-- Daily Briefings table for FairwayPro
-- Stores AI-generated morning briefings per coach per day

CREATE TABLE IF NOT EXISTS daily_briefings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  briefing_date DATE NOT NULL,
  cards JSONB NOT NULL DEFAULT '{}',
  opened_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, briefing_date)
);

-- RLS: coaches can only read their own briefings
ALTER TABLE daily_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches read own briefings" ON daily_briefings
  FOR SELECT USING (auth.uid() = coach_id);

-- Index for fast lookup
CREATE INDEX idx_daily_briefings_coach_date ON daily_briefings(coach_id, briefing_date DESC);
