# Database Scripts

## POI Database Setup

To set up the Points of Interest (POI) backend, run these SQL scripts in your Supabase SQL Editor:

### 1. Create Tables

Run `schema-pois.sql` first to create the database tables:
- `speed_traps` - Speed trap locations
- `segments` - Racing segment routes
- `car_meets` - Car meet event locations
- `speed_trap_records` - Speed trap leaderboard entries
- `segment_records` - Segment leaderboard entries
- `car_meet_attendees` - Car meet attendee tracking

### 2. Seed Initial Data

Run `seed-pois.sql` to populate the database with test data:
- 3 speed traps
- 2 segments
- 3 car meets

**Important:** Before running the seed script, you need to update the `created_by` field with a real user ID from your `profiles` table.

To find a user ID:
```sql
SELECT id FROM profiles LIMIT 1;
```

Then replace all instances of `'00000000-0000-0000-0000-000000000000'` in `seed-pois.sql` with the actual UUID.

### 3. Verify Setup

Check that tables were created:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%speed%' OR table_name LIKE '%segment%' OR table_name LIKE '%car_meet%';
```

Verify seed data:
```sql
SELECT COUNT(*) FROM speed_traps;
SELECT COUNT(*) FROM segments;
SELECT COUNT(*) FROM car_meets;
```

## Row Level Security (RLS)

The tables currently have no RLS policies. For production, consider adding policies to:
- Allow public read access to POIs
- Restrict POI creation to authenticated users
- Allow users to add their own leaderboard records
- Prevent users from modifying others' records

Example RLS policy:
```sql
-- Allow anyone to read speed traps
ALTER TABLE speed_traps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Speed traps are viewable by everyone"
  ON speed_traps FOR SELECT
  USING (true);

-- Allow authenticated users to create speed traps
CREATE POLICY "Authenticated users can create speed traps"
  ON speed_traps FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);
```
