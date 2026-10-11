CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visningsnavn TEXT NOT NULL,
  rolle TEXT NOT NULL CHECK (rolle IN ('forelder', 'barn')),
  farge TEXT NOT NULL DEFAULT '#4f8cff',
  emoji TEXT,
  pin_hash TEXT,
  aktiv INTEGER NOT NULL DEFAULT 1,
  opprettet TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opprettet TEXT NOT NULL,
  sist_brukt TEXT NOT NULL,
  utloper TEXT NOT NULL,
  enhet TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE auth_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tidspunkt TEXT NOT NULL,
  ip TEXT,
  vellykket INTEGER NOT NULL
);
CREATE INDEX idx_auth_attempts_user ON auth_attempts(user_id, tidspunkt);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tidspunkt TEXT NOT NULL,
  user_id INTEGER,
  handling TEXT NOT NULL,
  detaljer TEXT
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tittel TEXT NOT NULL,
  start TEXT NOT NULL,
  slutt TEXT,
  hel_dag INTEGER NOT NULL DEFAULT 0,
  sted TEXT,
  kilde TEXT NOT NULL DEFAULT 'manuell',
  ekstern_id TEXT,
  opprettet_av INTEGER REFERENCES users(id),
  opprettet TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (kilde, ekstern_id)
);
CREATE INDEX idx_events_start ON events(start);

CREATE TABLE event_participants (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE settings (
  nokkel TEXT PRIMARY KEY,
  verdi TEXT NOT NULL
);
