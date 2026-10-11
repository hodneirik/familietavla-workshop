CREATE TABLE gjoremal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tittel TEXT NOT NULL,
  poeng INTEGER NOT NULL DEFAULT 0 CHECK (poeng >= 0 AND poeng <= 1000),
  status TEXT NOT NULL DEFAULT 'ledig' CHECK (status IN ('ledig', 'tatt', 'venter', 'godkjent')),
  eier_id INTEGER REFERENCES users(id),
  opprettet_av INTEGER REFERENCES users(id),
  opprettet TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  tatt TEXT,
  fullfort TEXT,
  godkjent TEXT,
  godkjent_av INTEGER REFERENCES users(id),
  -- Et ledig gjøremål har ingen eier, alle andre har
  CHECK ((status = 'ledig' AND eier_id IS NULL) OR (status <> 'ledig' AND eier_id IS NOT NULL))
);
CREATE INDEX idx_gjoremal_status ON gjoremal(status);
CREATE INDEX idx_gjoremal_eier ON gjoremal(eier_id);

-- Poengjournal: saldoen er summen. Poeng som er gitt blir stående selv om gjøremålet slettes.
CREATE TABLE poeng_logg (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  poeng INTEGER NOT NULL,
  grunn TEXT NOT NULL,
  gjoremal_id INTEGER REFERENCES gjoremal(id) ON DELETE SET NULL,
  tidspunkt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_poeng_logg_user ON poeng_logg(user_id);
