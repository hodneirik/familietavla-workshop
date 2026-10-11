-- Lekser som en voksen legger inn for et barn. Barnet (eller en voksen) krysser av når den er gjort.
CREATE TABLE lekser (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barn_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fag TEXT,
  tittel TEXT NOT NULL,
  -- Fritekst med mer om hva som skal gjøres
  fritekst TEXT,
  -- Dagen leksa skal være gjort, ÅÅÅÅ-MM-DD
  frist TEXT NOT NULL,
  gjort TEXT,
  gjort_av INTEGER REFERENCES users(id) ON DELETE SET NULL,
  opprettet_av INTEGER REFERENCES users(id) ON DELETE SET NULL,
  opprettet TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_lekser_barn ON lekser(barn_id, frist);
