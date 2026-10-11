CREATE TABLE lapper (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  forfatter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tekst TEXT NOT NULL,
  farge TEXT NOT NULL DEFAULT 'gul' CHECK (farge IN ('gul', 'rosa', 'blå', 'grønn', 'oransje')),
  opprettet TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  endret TEXT
);
CREATE INDEX idx_lapper_opprettet ON lapper(opprettet);
