-- Gjentakende gjøremål: «daglig», «ukentlig» eller «maanedlig». Når en gjentakende oppgave godkjennes,
-- blir den ledig igjen fra «ledig_fra» (neste dag, neste mandag eller den 1. i neste måned).
ALTER TABLE gjoremal ADD COLUMN gjentas TEXT CHECK (gjentas IN ('daglig', 'ukentlig', 'maanedlig'));
ALTER TABLE gjoremal ADD COLUMN ledig_fra TEXT;

-- Avtaler som gjentas hver uke fram til og med denne datoen (ÅÅÅÅ-MM-DD). Tomt betyr at avtalen ikke gjentas.
ALTER TABLE events ADD COLUMN gjentas_til TEXT;
