-- POI Tables Schema for Project Apex
-- Run this in Supabase SQL Editor

-- Speed Traps
CREATE TABLE speed_traps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Segments
CREATE TABLE segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_lat DOUBLE PRECISION NOT NULL,
  start_lon DOUBLE PRECISION NOT NULL,
  end_lat DOUBLE PRECISION NOT NULL,
  end_lon DOUBLE PRECISION NOT NULL,
  distance_meters INTEGER NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Car Meets
CREATE TABLE car_meets (
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

-- Speed Trap Records (Leaderboard)
CREATE TABLE speed_trap_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trap_id UUID NOT NULL REFERENCES speed_traps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  vehicle_id UUID REFERENCES vehicles(id),
  speed DOUBLE PRECISION NOT NULL,
  vehicle_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_speed_trap_records_trap_speed ON speed_trap_records(trap_id, speed DESC);
CREATE INDEX idx_speed_trap_records_user ON speed_trap_records(user_id);

-- Segment Records (Leaderboard)
CREATE TABLE segment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  vehicle_id UUID REFERENCES vehicles(id),
  time_seconds DOUBLE PRECISION NOT NULL,
  vehicle_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_segment_records_segment_time ON segment_records(segment_id, time_seconds ASC);
CREATE INDEX idx_segment_records_user ON segment_records(user_id);

-- Car Meet Attendees
CREATE TABLE car_meet_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meet_id UUID NOT NULL REFERENCES car_meets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meet_id, user_id)
);

CREATE INDEX idx_car_meet_attendees_meet ON car_meet_attendees(meet_id);
