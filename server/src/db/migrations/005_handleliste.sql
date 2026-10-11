CREATE TABLE handleliste (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  navn TEXT NOT NULL,
  -- Navnet med små bokstaver og samlet mellomrom, brukt til å finne dubletter og til forslag
  navn_norm TEXT NOT NULL,
  kjopt INTEGER NOT NULL DEFAULT 0,
  lagt_til_av INTEGER REFERENCES users(id),
  opprettet TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  kjopt_tid TEXT,
  kjopt_av INTEGER REFERENCES users(id)
);
CREATE INDEX idx_handleliste_norm ON handleliste(navn_norm);

-- Varer som er handlet før. Det er dem som dukker opp som forslag når man begynner å skrive.
CREATE TABLE kjente_varer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  navn TEXT NOT NULL,
  navn_norm TEXT NOT NULL UNIQUE,
  antall_kjopt INTEGER NOT NULL DEFAULT 0,
  sist_kjopt TEXT NOT NULL
);
