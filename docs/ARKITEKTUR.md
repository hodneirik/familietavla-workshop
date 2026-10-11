# Arkitektur

Kartet over appen, til bruk i workshopen. Alt her stemmer med koden i denne kopien.

## Det store bildet

Én Node-prosess serverer både API-et og den ferdig bygde nettsiden. Data ligger i én SQLite-fil. Det er bevisst enkelt: én ting å bygge, starte og feilsøke.

```
Nettleser (mobil, nettbrett, pc)
        |
        v
   Express (server/)       API under /api, serverer også web/dist
        |
        v
   SQLite-fil (data/tavla.db)    migrasjoner kjøres ved oppstart
```

## Mapper

```
server/src/
  app.ts           bygger Express-appen: sikkerhetshoder, grenser, ruter
  config.ts        leser og validerer miljøvariabler (appen nekter å starte med feil oppsett)
  core/            innlogging, PIN, revisjonslogg, feil, datoer
  db/              åpning av databasen, migrasjonsløper, backup, demodata
    migrations/    001_init.sql, 002_..., kun fremover
  modules/<navn>/  routes.ts (HTTP og validering) og service.ts (logikken)
  cli/             kommandolinje: add-user, reset-pin, backup, seed-demo
server/test/       tester per modul, kjører mot en database i minnet
web/src/
  app/             skall, innlogging, faner
  design/          designsystem: tokens.css og små byggeklosser
  features/<navn>/ én mappe per fane
```

## Slik legges en ny funksjon til

Alle moduler er bygget likt, og det er poenget:

1. En ny migrasjonsfil i `server/src/db/migrations/` som lager tabellene.
2. `server/src/modules/<navn>/service.ts` med logikken, og `routes.ts` med ruter og validering.
3. En mappe i `web/src/features/<navn>/` med skjermen, og én linje i faneregisteret som sier hvilke roller som ser den.
4. Tester for modulen.

## Roller

Fire brukere i demoen, tre roller: **forelder** (alt), **barn** (egne gjøremål og lekser, ser handleliste og middag) og **besteforelder** (litt mer avgrenset: Hjem, gjøremål og profil). Rolleregler ligger i `service.ts` i hver modul og sjekkes på serveren, ikke bare ved at knapper skjules i nettsiden.

## Sikkerhet: lagene

Appen er laget for å kunne stå på internett, med lag på lag:

1. **Utenfor appen.** I en ekte installasjon står det en innlogging foran (en tunnel med tilgangskontroll), slik at fremmede stoppes før de ser noe. Dette er utelatt i workshopkopien, og er det viktigste laget for fremmede.
2. **Appens egne brukere.** PIN lagres aldri i klartekst, men hashes med `scrypt` og eget salt. Innlogging gir en tilfeldig økt-ID i en `httpOnly`-cookie (`SameSite=Lax`, signert), og selve økten ligger i databasen så den kan avsluttes. Fem feil PIN-forsøk på samme bruker gir fem minutters pause, og forsøk logges. Innlogging har også egen grense per IP.
3. **Roller på serveren.** Hver endring sjekker rollen i `service.ts`. Barn kan ikke gjøre foreldrehandlinger selv om de kaller API-et direkte.

I tillegg til lagene:

- **Sikkerhetshoder og innholdspolicy** (`helmet`, streng CSP, ingen innramming).
- **Grenser:** hastighetsbegrensning på alle API-kall, og størrelsesgrense på forespørsler.
- **Validering** av all inndata med `zod`, og kun parametriserte SQL-spørringer.
- **Kontroll av `Origin`** på alle endrende kall, mot forfalskede forespørsler.
- **Revisjonslogg** (`audit_log`) for innlogging, endringer og feil innlogging.
- **Hemmeligheter** bare i `.env`, aldri i git. Appen nekter å starte uten en gyldig `SESSION_SECRET`.
- **KI** (valgfritt): barnas navn byttes ut med «barn A, B, C» før noe sendes, og det er et månedlig kostnadstak.

## Backup og drift

`npm run cli -- backup` tar en konsistent kopi av databasen mens appen kjører (`VACUUM INTO`), sjekker at den er frisk, og rydder gamle kopier. `restore` legger en tilbake og tar vare på dagens database. Migrasjoner kjøres ved oppstart og bare fremover.

## Tester

Hver modul har tester som kjører mot en database i minnet, så de er raske. Innlogging, roller, utestenging og at ingen beskyttet rute svarer uten innlogging er dekket. CI kjører format, lint, typesjekk, tester og bygg ved hver endring.

## Kjente svakheter (godt materiale til workshopen)

- PIN på fire sifre er svakt alene. Det er derfor lag 1 finnes.
- Enkelte tekster brytes midt i ord på smal skjerm.
- Demodataene har enkle, kjente PIN-er med vilje.
