-- Mengder på handlelisten: hver middag kan si hvor mye den trenger av en vare, og lista legger sammen.
ALTER TABLE handleliste_middag ADD COLUMN mengde REAL;
ALTER TABLE handleliste_middag ADD COLUMN enhet TEXT;

-- Hvor mange voksne som spiser middag. Barna telles fra brukerne. Brukes av KI-en til mengder og porsjoner.
ALTER TABLE ki_regler ADD COLUMN voksne INTEGER NOT NULL DEFAULT 1 CHECK (voksne BETWEEN 1 AND 8);
