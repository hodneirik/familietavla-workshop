-- KI i appen (bare for foreldre). Ingen PDF, ingen prompt og ingen svar fra KI-en lagres her.

-- Klasse per barn, så KI-en velger riktig gruppe i timeplanen uten å spørre. Navn sendes aldri til KI-en.
CREATE TABLE ki_profil (
  barn_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  klasse TEXT NOT NULL CHECK (length(klasse) BETWEEN 1 AND 6),
  oppdatert TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  oppdatert_av INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Én rad: faste regler til KI-en, og kalenderen skoleavtaler havner i som standard.
CREATE TABLE ki_regler (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  tekst TEXT NOT NULL DEFAULT '' CHECK (length(tekst) <= 2000),
  standard_kalender_id INTEGER REFERENCES kalendere(id) ON DELETE SET NULL,
  oppdatert TEXT,
  oppdatert_av INTEGER REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO ki_regler (id) VALUES (1);

-- Én rad per KI-kall, også de som feilet. Grunnlaget for månedstaket.
CREATE TABLE ki_logg (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tid TEXT NOT NULL,
  -- ÅÅÅÅ-MM i norsk tid
  maaned TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  formaal TEXT NOT NULL CHECK (formaal IN ('ukeplan', 'middag', 'ingredienser')),
  modell TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_skriv_tokens INTEGER NOT NULL DEFAULT 0,
  cache_les_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  kostnad_mikrousd INTEGER NOT NULL DEFAULT 0,
  -- Kursen dollar til kroner som gjaldt da, så historikken kan etterprøves
  kurs REAL NOT NULL,
  kostnad_ore INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('ok', 'refusal', 'max_tokens', 'ugyldig_svar', 'feil')),
  request_id TEXT,
  varighet_ms INTEGER
);
CREATE INDEX idx_ki_logg_maaned ON ki_logg(maaned);

-- Hva som faktisk ble lagt inn, og kontrollsummen til PDF-en, så samme plan ikke leses to ganger uten at man får beskjed.
CREATE TABLE ki_planer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  formaal TEXT NOT NULL DEFAULT 'ukeplan',
  uke_start TEXT NOT NULL,
  kontrollsum TEXT NOT NULL,
  innlagt TEXT NOT NULL,
  innlagt_av INTEGER REFERENCES users(id) ON DELETE SET NULL,
  barn_ider TEXT NOT NULL DEFAULT '[]',
  antall_lekser INTEGER NOT NULL DEFAULT 0,
  antall_avtaler INTEGER NOT NULL DEFAULT 0,
  antall_lapper INTEGER NOT NULL DEFAULT 0,
  ider_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_ki_planer_kontrollsum ON ki_planer(kontrollsum);
CREATE INDEX idx_ki_planer_uke ON ki_planer(formaal, uke_start);
