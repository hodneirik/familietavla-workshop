-- foreign_keys: off
-- Gjentakende gjøremål får verdien «annenhver_uke». SQLite kan ikke endre en CHECK-regel på plass,
-- så gjoremal bygges om (ny tabell, kopi, bytt navn), med utenlandsnøklene av mens det pågår.
CREATE TABLE gjoremal_ny (
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
  frist TEXT,
  gjentas TEXT CHECK (gjentas IN ('daglig', 'ukentlig', 'annenhver_uke', 'maanedlig')),
  ledig_fra TEXT,
  -- Et ledig gjøremål har ingen eier, alle andre har
  CHECK ((status = 'ledig' AND eier_id IS NULL) OR (status <> 'ledig' AND eier_id IS NOT NULL))
);
INSERT INTO gjoremal_ny (id, tittel, poeng, status, eier_id, opprettet_av, opprettet, tatt, fullfort,
                         godkjent, godkjent_av, frist, gjentas, ledig_fra)
  SELECT id, tittel, poeng, status, eier_id, opprettet_av, opprettet, tatt, fullfort,
         godkjent, godkjent_av, frist, gjentas, ledig_fra
  FROM gjoremal;
DROP TABLE gjoremal;
ALTER TABLE gjoremal_ny RENAME TO gjoremal;
CREATE INDEX idx_gjoremal_status ON gjoremal(status);
CREATE INDEX idx_gjoremal_eier ON gjoremal(eier_id);
