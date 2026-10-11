-- Faste middagsretter som voksne vedlikeholder, med notat og en liste med ingredienser (JSON).
CREATE TABLE retter (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tittel TEXT NOT NULL,
  tittel_norm TEXT NOT NULL UNIQUE,
  notat TEXT,
  ingredienser TEXT NOT NULL DEFAULT '[]',
  opprettet_av INTEGER REFERENCES users(id),
  opprettet TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  endret TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Middager som allerede var lagt inn som fritekst, blir til retter slik at ingenting går tapt.
INSERT INTO retter (tittel, tittel_norm, notat)
SELECT MIN(m.rett), lower(m.rett),
       (SELECT m2.notat FROM middag m2 WHERE lower(m2.rett) = lower(m.rett) AND m2.notat IS NOT NULL ORDER BY m2.dato LIMIT 1)
FROM middag m
GROUP BY lower(m.rett);

-- Middagsplanen peker nå på en rett. Navnet lagres også, så en dag fortsatt har navn om retten slettes.
CREATE TABLE middag_ny (
  dato TEXT PRIMARY KEY,
  rett_id INTEGER REFERENCES retter(id) ON DELETE SET NULL,
  rett TEXT NOT NULL,
  opprettet_av INTEGER REFERENCES users(id),
  endret TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO middag_ny (dato, rett_id, rett, opprettet_av, endret)
SELECT m.dato, r.id, m.rett, m.opprettet_av, m.endret
FROM middag m LEFT JOIN retter r ON r.tittel_norm = lower(m.rett);
DROP TABLE middag;
ALTER TABLE middag_ny RENAME TO middag;

-- Stjerner (1 til 5) for en bestemt dags middag. Hver gang en rett serveres, får alle nye stemmer,
-- og snittet for retten er snittet av alle stemmene fra alle dagene den har vært servert.
CREATE TABLE middag_stjerner (
  dato TEXT NOT NULL REFERENCES middag(dato) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  stjerner INTEGER NOT NULL CHECK (stjerner BETWEEN 1 AND 5),
  tidspunkt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (dato, user_id)
);

-- Handlelisten får et notat per vare, og en kobling til middagen en vare er lagt til for.
ALTER TABLE handleliste ADD COLUMN notat TEXT;
CREATE TABLE handleliste_middag (
  vare_id INTEGER NOT NULL REFERENCES handleliste(id) ON DELETE CASCADE,
  dato TEXT NOT NULL REFERENCES middag(dato) ON DELETE CASCADE,
  -- 1 hvis varen ble lagt til på lista for akkurat denne middagen (og kan fjernes igjen)
  ny INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (vare_id, dato)
);
