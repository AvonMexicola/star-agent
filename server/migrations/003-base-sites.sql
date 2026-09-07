-- Solo construction persistence is separate from authoritative multiplayer inventory.
CREATE TABLE base_sites (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
