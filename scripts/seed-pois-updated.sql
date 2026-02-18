-- Seed POI data for Project Apex (Updated for existing schema)
-- Run this AFTER migration-pois.sql
-- Note: Replace 'YOUR_USER_ID_HERE' with a real user ID from your profiles table

-- First, get your user ID by running: SELECT id FROM profiles LIMIT 1;
-- Then replace all instances of 'YOUR_USER_ID_HERE' below

-- Insert mock speed traps
INSERT INTO speed_traps (id, name, latitude, longitude, description, created_by)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Highway Zone', 40.4168, -3.7038, 'Long straight on the highway', 'YOUR_USER_ID_HERE'),
  ('00000000-0000-0000-0000-000000000002', 'Industrial Zone', 40.4200, -3.7100, 'Wide road near the factories', 'YOUR_USER_ID_HERE'),
  ('00000000-0000-0000-0000-000000000003', 'Airport Road', 40.4050, -3.6900, 'Smooth asphalt near the airport', 'YOUR_USER_ID_HERE')
ON CONFLICT (id) DO NOTHING;

-- Update or insert segments (with start_radius and end_radius for existing schema)
INSERT INTO segments (id, name, start_lat, start_lon, start_radius, end_lat, end_lon, end_radius, distance_meters, description, created_by)
VALUES
  ('00000000-0000-0000-0000-000000000004', 'Mountain Pass', 40.4150, -3.7000, 50.0, 40.4250, -3.6900, 50.0, 1200, 'Twisty mountain road with hairpins', 'YOUR_USER_ID_HERE'),
  ('00000000-0000-0000-0000-000000000005', 'Coastal Sprint', 40.4100, -3.7200, 50.0, 40.4000, -3.7300, 50.0, 2500, 'Fast coastal road with ocean views', 'YOUR_USER_ID_HERE')
ON CONFLICT (id) DO NOTHING;

-- Insert mock car meets
INSERT INTO car_meets (id, name, latitude, longitude, description, schedule, created_by)
VALUES
  ('00000000-0000-0000-0000-000000000006', 'Sunday Cars & Coffee', 40.4220, -3.6950, 'Weekly car meet, all cars welcome! Great coffee and car chat.', 'Sundays 9AM-12PM', 'YOUR_USER_ID_HERE'),
  ('00000000-0000-0000-0000-000000000007', 'JDM Night Meet', 40.4080, -3.7150, 'Japanese cars only. Show off your builds!', 'Saturdays 8PM', 'YOUR_USER_ID_HERE'),
  ('00000000-0000-0000-0000-000000000008', 'Euro Cars Monthly', 40.4300, -3.7000, 'European car enthusiasts meetup', 'First Saturday of month', 'YOUR_USER_ID_HERE')
ON CONFLICT (id) DO NOTHING;
