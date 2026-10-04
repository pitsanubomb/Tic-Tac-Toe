CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  photo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scores (
  uid TEXT PRIMARY KEY REFERENCES users(uid),
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL REFERENCES users(uid),
  result TEXT NOT NULL CHECK (result IN ('w', 'd', 'l')),
  human_first INTEGER NOT NULL DEFAULT 1,
  moves TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_games_uid ON games (uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_wins ON scores (wins DESC);
