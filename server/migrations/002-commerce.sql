CREATE TABLE IF NOT EXISTS commerce_state (
  id text PRIMARY KEY CHECK (id = 'world-7291'),
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
