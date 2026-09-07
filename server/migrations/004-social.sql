-- 002 is reserved by commerce, 003 by base sites. Social data is independent of inventory.
CREATE TABLE friendships (
  account_low uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  account_high uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_low, account_high),
  CHECK (account_low < account_high),
  CHECK (requested_by = account_low OR requested_by = account_high)
);
CREATE INDEX friendships_high ON friendships(account_high);
CREATE TABLE social_blocks (
  blocker uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  blocked uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker, blocked),
  CHECK (blocker <> blocked)
);
CREATE INDEX social_blocks_target ON social_blocks(blocked);
