-- foreign_keys: off
-- Tredje brukertype: besteforelder. SQLite kan ikke endre en CHECK-regel på plass, så users bygges
-- om etter oppskriften i dokumentasjonen til SQLite (ny tabell, kopi, bytt navn). Utenlandsnøklene
-- er slått av mens det pågår (se migrate.ts), og kontrolleres etterpå.
CREATE TABLE users_ny (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visningsnavn TEXT NOT NULL,
  rolle TEXT NOT NULL CHECK (rolle IN ('forelder', 'barn', 'besteforelder')),
  farge TEXT NOT NULL DEFAULT '#4f8cff',
  emoji TEXT,
  pin_hash TEXT,
  aktiv INTEGER NOT NULL DEFAULT 1,
  opprettet TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO users_ny (id, visningsnavn, rolle, farge, emoji, pin_hash, aktiv, opprettet)
  SELECT id, visningsnavn, rolle, farge, emoji, pin_hash, aktiv, opprettet FROM users;
DROP TABLE users;
ALTER TABLE users_ny RENAME TO users;
