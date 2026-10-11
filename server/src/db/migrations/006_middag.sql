-- Én middag per dag. Dato er lokal dato i Norge (ÅÅÅÅ-MM-DD).
CREATE TABLE middag (
  dato TEXT PRIMARY KEY,
  rett TEXT NOT NULL,
  notat TEXT,
  opprettet_av INTEGER REFERENCES users(id),
  endret TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
