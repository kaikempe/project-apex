-- POI Migration for Project Apex
-- This adds missing tables/columns to work with existing schema

-- Add missing columns to existing segments table
ALTER TABLE segments
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Speed Traps (new table)
CREATE TABLE IF NOT EXISTS speed_traps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Car Meets (new table)
CREATE TABLE IF NOT EXISTS car_meets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  description TEXT,
  schedule TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Speed Trap Records (new leaderboard table)
CREATE TABLE IF NOT EXISTS speed_trap_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trap_id UUID NOT NULL REFERENCES speed_traps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  vehicle_id UUID REFERENCES vehicles(id),
  speed DOUBLE PRECISION NOT NULL,
  vehicle_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speed_trap_records_trap_speed
  ON speed_trap_records(trap_id, speed DESC);
CREATE INDEX IF NOT EXISTS idx_speed_trap_records_user
  ON speed_trap_records(user_id);

-- Segment Records (new leaderboard table)
CREATE TABLE IF NOT EXISTS segment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  vehicle_id UUID REFERENCES vehicles(id),
  time_seconds DOUBLE PRECISION NOT NULL,
  vehicle_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segment_records_segment_time
  ON segment_records(segment_id, time_seconds ASC);
CREATE INDEX IF NOT EXISTS idx_segment_records_user
  ON segment_records(user_id);

-- Car Meet Attendees (new table)
CREATE TABLE IF NOT EXISTS car_meet_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meet_id UUID NOT NULL REFERENCES car_meets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meet_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_car_meet_attendees_meet
  ON car_meet_attendees(meet_id);
