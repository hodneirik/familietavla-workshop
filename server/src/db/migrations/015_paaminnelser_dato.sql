-- foreign_keys: off
-- Påminnelser kan også gjelde én bestemt dag (turdag) eller bare en periode (svømming noen uker).
-- ukedag blir valgfri og får selskap av dato, fra og til. SQLite kan ikke fjerne NOT NULL på plass,
-- så tabellen bygges om (ny tabell, kopi, bytt navn).
CREATE TABLE paaminnelser_ny (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barn_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tittel TEXT NOT NULL COLLATE NOCASE,
  -- Hver uke på denne ukedagen: 0 = mandag, 6 = søndag. Tom for en enkeltdag.
  ukedag INTEGER CHECK (ukedag BETWEEN 0 AND 6),
  -- En enkeltdag, ÅÅÅÅ-MM-DD. Tom for en fast ukedag.
  dato TEXT,
  -- Bare i en periode (for fast ukedag): første og siste dag, begge valgfrie.
  fra TEXT,
  til TEXT,
  opprettet_av INTEGER REFERENCES users(id) ON DELETE SET NULL,
  opprettet TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((ukedag IS NOT NULL) <> (dato IS NOT NULL)),
  CHECK (dato IS NULL OR (fra IS NULL AND til IS NULL))
);
INSERT INTO paaminnelser_ny (id, barn_id, tittel, ukedag, opprettet_av, opprettet)
  SELECT id, barn_id, tittel, ukedag, opprettet_av, opprettet FROM paaminnelser;
DROP TABLE paaminnelser;
ALTER TABLE paaminnelser_ny RENAME TO paaminnelser;
CREATE UNIQUE INDEX ux_paaminnelser ON paaminnelser (
  barn_id, tittel, COALESCE(ukedag, -1), COALESCE(dato, ''), COALESCE(fra, ''), COALESCE(til, '')
);
CREATE INDEX idx_paaminnelser_barn ON paaminnelser(barn_id, ukedag);
-- Påminnelser kan også gjelde én bestemt dag (turdag) eller bare en periode (svømming noen uker).
