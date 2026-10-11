-- Flere kalendere med eget navn og egen farge. Kilden gjør at kalendere fra f.eks. Spond kan komme senere.
CREATE TABLE kalendere (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  navn TEXT NOT NULL,
  farge TEXT NOT NULL DEFAULT '#4f8cff',
  kilde TEXT NOT NULL DEFAULT 'manuell',
  ekstern_id TEXT,
  opprettet TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (kilde, ekstern_id)
);
INSERT INTO kalendere (navn, farge) VALUES ('Familie', '#4f8cff');

-- Hver avtale hører til en kalender. Tidene i events.start og events.slutt er lokal klokketid i Norge
-- (ÅÅÅÅ-MM-DDTHH:MM), med halvåpent intervall. En hel-dag-avtale går fra midnatt til neste midnatt.
ALTER TABLE events ADD COLUMN kalender_id INTEGER REFERENCES kalendere(id) ON DELETE CASCADE;
CREATE INDEX idx_events_kalender ON events(kalender_id);

-- Gjøremål kan senere få en frist som også vises i kalenderen (lokal dato eller klokketid, som events).
ALTER TABLE gjoremal ADD COLUMN frist TEXT;
