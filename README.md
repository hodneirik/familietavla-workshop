# Familietavla (workshopkopi)

En mobilvennlig familietavle: oppslagstavle, kalender, middagsplan, handleliste, gjøremål med poeng, lekser og mer, i én nettapp. Bygget i små steg sammen med Claude Code, og delt som utgangspunkt for en praktisk workshop om å lage bedre løsninger med KI.

Dette er en **ren kopi** med oppdiktede brukere. Ingenting her tilhører en ekte familie.

![Hjem](docs/skjermbilder/2-hjem-forelder.png)

## Kom i gang på fem minutter

Du trenger Node.js 22.13 eller nyere (`node -v`) og Git.

```bash
npm install
cp .env.example .env
npm run seed:demo      # lager en oppdiktet familie med eksempeldata
npm run dev            # åpne http://localhost:5173
```

Logg inn med:

| Bruker | Rolle         | PIN  |
| ------ | ------------- | ---- |
| Anita  | forelder      | 1111 |
| Elias  | barn          | 2222 |
| Nelly  | barn          | 3333 |
| Farmor | besteforelder | 4444 |

Vil du starte på nytt? Slett mappen `server/data` og kjør `npm run seed:demo` igjen.

Oppskriften og oppgavene til workshopen står i **[WORKSHOP.md](WORKSHOP.md)**. Hvordan appen er bygget står i **[docs/ARKITEKTUR.md](docs/ARKITEKTUR.md)**.

## Kommandoer

```bash
npm run dev            # server (3000) og nettside (5173) med hot reload
npm test               # alle tester (server og web)
npm run lint           # eslint
npm run typecheck      # TypeScript
npm run format         # prettier
npm run build          # bygg for drift
npm run cli -- list-users   # kommandolinje for brukere, backup og demodata
```

Før du sender inn en endring: `npm test && npm run lint && npm run typecheck && npm run format:check`. Det samme kjører i GitHub Actions.

## Valgfritt

- **Docker:** `docker compose up --build`, og last inn demofamilien med `docker compose exec app node dist/cli/index.js seed-demo`.
- **KI i appen** (ukeplan som PDF, middagsforslag for voksne) er av til du legger en `ANTHROPIC_API_KEY` i `.env`. Resten av appen virker uten.
- **Værvarsel** er av i denne kopien (eksternt API). Sett `VAER_AKTIV=true` i `.env` for å se det.

## Lisens

MIT, se [LICENSE](LICENSE). Bruk, endre og del fritt.
