# Workshop: bedre løsninger med KI, på et ekte kodeprosjekt

En time, praktisk, i Teams. Utgangspunktet er Familietavla: en nettapp som er bygget i små steg med KI. To innfallsvinkler, to vurderinger:

- **Del 1: design og brukeropplevelse.** Hvordan ser appen ut for en bruker, og hvordan kan KI hjelpe oss å gjøre den bedre?
- **Del 2: sikkerhet, struktur og kodekvalitet.** Hvordan vurderer vi koden, og hva gjør vi med det KI foreslår?

Ikke for mye teori. Vi ser på ekte kode, prøver ting og diskuterer.

## Før workshopen (10 minutter)

Følg **[Kom i gang i README](README.md#kom-i-gang-10-minutter)**. Der står alle stegene, med egne kommandoer for Mac og PC. Når appen kjører og du er logget inn som **Anita** (PIN 1111), er du klar.

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
