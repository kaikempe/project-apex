-- Rivals: each user can designate up to 3 rivals
CREATE TABLE rivals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rival_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rivals_no_self CHECK (user_id <> rival_id),
  CONSTRAINT rivals_unique_pair UNIQUE (user_id, rival_id)
);

CREATE INDEX idx_rivals_user ON rivals(user_id);

ALTER TABLE rivals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rivals_read_own" ON rivals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rivals_insert_own" ON rivals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rivals_delete_own" ON rivals FOR DELETE TO authenticated USING (auth.uid() = user_id);
