-- Faste ukentlige påminnelser til barna, som gym og bibliotek. De hører ikke hjemme i kalenderen:
-- de gjentas hver uke på samme ukedag, og vises smått på dagen i «De neste dagene».
CREATE TABLE paaminnelser (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barn_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tittel TEXT NOT NULL COLLATE NOCASE,
  -- 0 = mandag, 6 = søndag
  ukedag INTEGER NOT NULL CHECK (ukedag BETWEEN 0 AND 6),
  opprettet_av INTEGER REFERENCES users(id) ON DELETE SET NULL,
  opprettet TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (barn_id, ukedag, tittel)
);
CREATE INDEX idx_paaminnelser_barn ON paaminnelser(barn_id, ukedag);
