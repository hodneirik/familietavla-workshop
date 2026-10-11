# Workshop: bedre løsninger med KI, på et ekte kodeprosjekt

En time, praktisk, i Teams. Utgangspunktet er Familietavla: en nettapp som er bygget i små steg med KI. To innfallsvinkler, to vurderinger:

- **Del 1: design og brukeropplevelse.** Hvordan ser appen ut for en bruker, og hvordan kan KI hjelpe oss å gjøre den bedre?
- **Del 2: sikkerhet, struktur og kodekvalitet.** Hvordan vurderer vi koden, og hva gjør vi med det KI foreslår?

Ikke for mye teori. Vi ser på ekte kode, prøver ting og diskuterer.

## Før workshopen (10 minutter)

Du gjør dette én gang, på din egen Mac eller PC. Hver kommando skrives i terminalen og avsluttes med Enter.

### Installer to programmer (første gang)

- **Node.js**, versjon 22 eller nyere: last ned fra nodejs.org og installer som vanlig.
- **Git**: last ned fra git-scm.com (PC). På Mac kan du hoppe over dette, for Mac tilbyr å installere Git første gang det trengs.

Åpne terminalen og sjekk at det virker. `node -v` skal vise 22.13 eller nyere.

- **Mac:** åpne programmet **Terminal** (søk etter «Terminal» med Cmd og mellomrom).
- **PC:** åpne **PowerShell** (søk etter «PowerShell» i startmenyen). Får du senere en feilmelding om at kjøring av skript er deaktivert, åpne **Ledetekst** (Command Prompt) i stedet og bruk de samme kommandoene.

### Last ned og start appen

1. **Last ned prosjektet.** Det lager en ny mappe som heter `familietavla` der terminalen står:
   ```bash
   git clone https://github.com/hodneirik/familietavla-workshop familietavla
   ```
2. **Gå inn i mappen.** Alle kommandoene under må kjøres herfra:
   ```bash
   cd familietavla
   ```
3. **Installer det appen trenger** (tar et minutt eller to, mye tekst er normalt):
   ```bash
   npm install
   ```
4. **Lag innstillingsfilen.**
   - Mac: `cp .env.example .env`
   - PC (PowerShell eller Ledetekst): `copy .env.example .env`
5. **Lag demofamilien:**
   ```bash
   npm run seed:demo
   ```
6. **Start appen** og la terminalvinduet stå åpent:
   ```bash
   npm run dev
   ```
7. Åpne http://localhost:5173 i nettleseren og logg inn som **Anita** (PIN 1111). Alle PIN-ene står i README.
8. Sjekk at `npm test` går grønt (kjør den i et nytt terminalvindu, i samme mappe). Da er alt på plass.

Står du fast, skriv `ls` (Mac) eller `dir` (PC) for å se hvilken mappe du er i. Du skal se `README.md` og `package.json`. Ellers har du glemt `cd familietavla`.

Du trenger ikke en API-nøkkel. Bruker du et KI-verktøy til koding (Claude Code, Cursor, Copilot eller lignende), er det en fordel, men ikke et krav.

## Rundtur i appen (5 minutter)

Gå gjennom som **forelder** (Anita), og så som **barn** (Elias) på smal skjerm (åpne utviklerverktøyene og velg mobilvisning). Legg merke til hva barnet ser og ikke ser. Prøv:

- Legg en lapp på oppslagstavla.
- La Elias ta et gjøremål og melde det ferdig, og godkjenn det som Anita. Se poengene.
- Legg til en middagsrett og se at ingrediensene havner på handlelisten.
- Logg inn som **Farmor**. Hva ser hun, og hvorfor?

## Del 1: design og brukeropplevelse

Tenk på brukeren: et barn på åtte, en forelder i farta, en bestemor som ikke er vant til apper.

1. **Finn og fiks.** På smal skjerm brytes «Tømme oppvaskmaskinen» midt i ordet («oppvaskmaskine» og så «n» på neste linje). Finn ut hvorfor, og la KI foreslå en løsning. Hva må du sjekke for at rettingen ikke ødelegger noe annet?
2. **Se med barneøyne.** Gå gjennom appen på mobil. Skriv ned tre ting som ville vært vanskelige for et barn på åtte. Be KI om forslag, og vurder dem selv før du tar dem inn.
3. **Designsystemet.** Alle farger, avstander og skrifter hentes fra `web/src/design/tokens.css`. Endre én verdi og se hva som skjer overalt. Hva sier det om hvorfor det lønner seg å samle dem?
4. **Tilgjengelighet.** Prøv å bruke appen bare med tastatur. Se på kontrast og på hva en skjermleser ville lest opp.

**Prompt-tips:** Beskriv brukeren og problemet, ikke bare løsningen. Be KI om to eller tre alternativer og en vurdering, ikke bare ett svar. Gi den filen den skal endre og det du ikke vil ha endret.

## Del 2: sikkerhet, struktur og kodekvalitet

Les først `docs/ARKITEKTUR.md`, så har du kartet.

1. **La KI gjennomgå innloggingen.** Be den om en sikkerhetsgjennomgang av `server/src/modules/auth` og `server/src/core/auth.ts`. Hvilke funn er reelle, og hvilke er støy? Hvordan kan du sjekke det?
2. **Bevis det med en test.** Skriv en test som viser at et barn ikke kan gjøre noe bare foreldre skal kunne. Se mønsteret i `server/test/auth.test.ts`.
3. **Legg til en liten ting etter mønsteret.** Alle moduler er bygget likt: en migrasjon, en `service.ts` med logikk, en `routes.ts` med validering, og en mappe i `web/src/features`. Be KI legge til noe lite (for eksempel et «kjøpt av»-felt på handlelisten) og vurder om den fulgte mønsteret.
4. **Les en diff kritisk.** Hva er forskjellen på kode som virker og kode du tør å sette i drift? Hva ville du sjekket manuelt?

**Prompt-tips:** Be KI om å forklare før den endrer. Be om små steg og at testene kjøres mellom hvert. Be den si hva den ikke er sikker på.

## Når du er ferdig med en endring

```bash
npm test && npm run lint && npm run typecheck && npm run format:check
```

Alt må være grønt. Det er den samme sjekken som kjører i GitHub Actions.

## Hva dette ikke er

Dette er en lokal demo med oppdiktede brukere og enkle PIN-er (1111 og så videre). Den er ikke ment å legges på internett slik den står. Sikkerhetslagene rundt (innlogging foran appen, hemmeligheter, backup) er med vilje utelatt, og du kan se på hvordan de bør komme på plass i `docs/ARKITEKTUR.md`.
