/**
 * Hva som er nytt i Familietavla, nyeste versjon først.
 *
 * HVER GANG DET LAGES EN NY OPPDATERING (regler fra eieren 2026-10-08):
 *  1. STORE NYE FUNKSJONER gir et nytt versjonsnummer (28, 29 og så videre) og neste navn i rekkefølgen
 *     under. Legg versjonen øverst i lista.
 *  2. MINDRE FIKSER og justeringer gir et delnummer på den siste store versjonen: 27.1, 27.2 og så videre.
 *     Bruk samme `nummer` og `navn`, og sett `delnummer`. Navnet endres ikke.
 *  3. Skriv endringene slik barna forstår dem. Merk det bare voksne bruker med `for: "voksne"`.
 *
 * Versjon 1 til 21 har dyrenavn i alfabetisk rekkefølge: Alke, Bever, Cheetah, Delfin, Elg, Frosk,
 * Gaupe, Hare, Isbjørn, Jerv, Kenguru, Lemen, Måke, Nesehorn, Oter, Panda, Rev, Sel, Tiur, Ugle, Villrein.
 *
 * Fra versjon 22 er navnene PLANTER, igjen i alfabetisk rekkefølge fra A (eieren bestemte det 2026-10-07).
 * Forslag, velg gjerne andre: Anemone, Bjørk, Calluna, Dahlia, Eføy, Fiol, Gullregn, Hagtorn, Iris,
 * Jordbær, Krokus, Lavendel, Mjødurt, Nøkkerose, Orkidé, Prestekrage, Rose, Solsikke, Tulipan, Valmue.
 * Hvilket navn som er brukt står i selve lista under, og nytt.test.ts passer på rekkefølgen.
 */
export interface Endring {
  tekst: string;
  /** Standard er «alle». «voksne» vises ikke for barn. */
  for?: "alle" | "voksne";
}

export interface Versjon {
  /** Hovednummer. Store nye funksjoner gir et nytt hovednummer. */
  nummer: number;
  /** Delnummer for mindre fikser på hovedversjonen: 1 gir «27.1». Mangler ved selve hovedversjonen. */
  delnummer?: number;
  navn: string;
  /** Dato i norsk tid, ÅÅÅÅ-MM-DD. */
  dato: string;
  tittel: string;
  endringer: Endring[];
}

export const versjoner: Versjon[] = [
  {
    nummer: 32,
    delnummer: 1,
    navn: "Krokus",
    dato: "2026-10-11",
    tittel: "Ukeplanen i KI og mer luft",
    endringer: [
      {
        tekst: "Uka skrives nå som «Uke 41: 05.10 - 11.10», med uka først og datoene etter.",
        for: "voksne",
      },
      {
        tekst:
          "Ingen barn er krysset av når du skal lese en ukeplan. Du velger selv hvem planen gjelder.",
        for: "voksne",
      },
      {
        tekst:
          "Mer luft mellom siste element og menyen nederst, så ingenting havner tett på knappene.",
      },
    ],
  },
  {
    nummer: 32,
    navn: "Krokus",
    dato: "2026-10-09",
    tittel: "Ryddigere og lettere å finne fram",
    endringer: [
      {
        tekst:
          "Hjem viser «I dag» øverst, så oppslagstavla og resten av dagene. Tavla er bare så stor som lappene den har.",
      },
      {
        tekst:
          "På iPaden står oppslagstavla til venstre og de neste dagene til høyre, så mer får plass uten å bla.",
      },
      {
        tekst:
          "Lekser-fanen heter nå Skole, og har både lekser og påminnelser som gym og turdager.",
      },
      {
        tekst:
          "Alle fanene ser likere ut: samme topp, de samme kortene i listene, og gjøremålene er lavere så flere får plass.",
      },
      {
        tekst:
          "KI-fanen er borte. «Les ukeplan med KI» ligger i Skole, akkurat som KI-knappene i Middag, og innstillingene for KI ligger under Innstillinger. Menyen har nå sju faner.",
        for: "voksne",
      },
      {
        tekst:
          "Handlelisten er kortere: «Til Taco · fre 9. okt.», og profilbildet vises bare når det er noen andre som har lagt til varen. Filvelgeren i KI er på norsk.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 31,
    delnummer: 1,
    navn: "Jordbær",
    dato: "2026-10-09",
    tittel: "Egne regler for middag",
    endringer: [
      {
        tekst:
          "KI-en tok med reglene for ukeplanen (turdager og gym) når den foreslo middag. Nå har middag egne regler under KI → Innstillinger, for eksempel «Ingen sopp», og de andre reglene sendes ikke dit.",
        for: "voksne",
      },
      { tekst: "En liten rettelse i hjelperen som foreslår middag." },
    ],
  },
  {
    nummer: 31,
    navn: "Jordbær",
    dato: "2026-10-09",
    tittel: "Mengder og mindre matsvinn",
    endringer: [
      {
        tekst:
          "Ingrediensene i middagsrettene kan nå ha mengde, for eksempel «400 g kjøttdeig». Trenger flere middager samme vare, legges mengdene sammen på handlelisten, så det står én linje med «600 g» i stedet for to.",
      },
      {
        tekst:
          "KI-en planlegger nå middager som passer for barn og som bruker opp ferske varer. Spiser dere taco, foreslår den en rett senere i uka som bruker opp salaten, og sier fra om det.",
        for: "voksne",
      },
      {
        tekst:
          "Når KI-en lager nye retter, skriver den mengder for familien og bruker de samme ingrediensnavnene som dere har fra før, så alt slås sammen på handlelisten. Under KI → Innstillinger kan du si hvor mange voksne som spiser middag.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 30,
    delnummer: 1,
    navn: "Iris",
    dato: "2026-10-09",
    tittel: "KI lager nye retter",
    endringer: [
      {
        tekst:
          "Under Retter i Middag finnes nå «Lag retter med KI». Skriv hva slags retter du vil ha, for eksempel raske fiskeretter, og KI-en lager forslag med ingredienser. Du kan rette dem og velge hvilke som skal legges til.",
        for: "voksne",
      },
      { tekst: "Det er blitt enklere for de voksne å fylle på med nye middagsretter." },
    ],
  },
  {
    nummer: 30,
    navn: "Iris",
    dato: "2026-10-09",
    tittel: "KI foreslår middag",
    endringer: [
      {
        tekst:
          "Over middagsplanen er det en ny knapp, «Foreslå middag med KI». Velg dagene, og KI-en foreslår middag for dem som mangler, ut fra rettene dere har, hvor mange stjerner de har fått og hva dere har spist de siste ukene.",
        for: "voksne",
      },
      {
        tekst:
          "Du kan bytte rett, velge bort dager og skrive ønsker som «fisk to ganger». Ingenting blir lagt inn før du trykker «Legg inn», og du velger selv om ingrediensene skal på handlelisten.",
        for: "voksne",
      },
      { tekst: "Middagsplanen har fått en hjelper som foreslår hva vi kan spise." },
    ],
  },
  {
    nummer: 29,
    delnummer: 2,
    navn: "Hagtorn",
    dato: "2026-10-09",
    tittel: "Påminnelser for enkeltdager og perioder",
    endringer: [
      {
        tekst:
          "Ikke alt skjer hver uke. Påminnelser kan nå gjelde bare én bestemt dag, for eksempel en turdag, eller bare noen uker, for eksempel svømming i en periode.",
      },
      {
        tekst:
          "KI-en foreslår nå påminnelser fra ukeplanen: gym og bibliotek som faste, svømming som periode og turdag som én dag. Du godkjenner og kan rette dem før de legges inn.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 29,
    delnummer: 1,
    navn: "Hagtorn",
    dato: "2026-10-09",
    tittel: "Rettelser i KI-en",
    endringer: [
      { tekst: "Noen små rettelser bak kulissene, så appen blir litt ryddigere for de voksne." },
      {
        tekst: "KI-en bruker nå barnas navn i lapper og spørsmål i stedet for bokstavene A og B.",
        for: "voksne",
      },
      {
        tekst: "«Hopp over» vises bare én gang under hvert spørsmål fra KI-en.",
        for: "voksne",
      },
      {
        tekst:
          "Knappene under KI-ens spørsmål brytes til flere linjer på små skjermer, så ingen går ut av bildet.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 29,
    navn: "Hagtorn",
    dato: "2026-10-09",
    tittel: "Faste påminnelser",
    endringer: [
      {
        tekst:
          "Ting som gym og bibliotek er ikke avtaler, men noe man skal huske hver uke. De er nå en egen slags påminnelse, og vises som en liten linje øverst på dagen i De neste dagene.",
      },
      {
        tekst:
          "Foreldrene legger inn påminnelser i Lekser-fanen: velg hva, hvilke dager og hvilke barn. Barna ser bare sine egne.",
        for: "voksne",
      },
      {
        tekst:
          "Når det kommer en ny versjon av appen, dukker det opp en stripe øverst: «Ny versjon av appen er klar». Trykk «Oppdater», så slipper du å lukke appen helt.",
      },
      {
        tekst:
          "«Meg» heter nå «Innstillinger», og er delt i faner: Min profil, Familie (bare foreldre) og Hva er nytt. Emoji og PIN ligger i bokser du åpner når du trenger dem, så siden ikke blir så lang.",
      },
    ],
  },
  {
    nummer: 28,
    navn: "Gullregn",
    dato: "2026-10-08",
    tittel: "KI hjelper med ukeplanen",
    endringer: [
      {
        tekst:
          "Foreldrene har fått en ny fane, KI. Der kan de gi KI-en ukeplanen fra skolen og få forslag til lekser, avtaler og lapper, som de godkjenner før noe blir lagt inn.",
      },
      {
        tekst:
          "Familie-siden ligger nå nederst under Meg for foreldre, så menyen ikke blir for trang.",
        for: "voksne",
      },
      {
        tekst:
          "KI-en bruker Claude fra Anthropic og er av til nøkkelen er lagt inn i .env. Appen stopper KI-kall når månedstaket (50 kr som standard) er nådd. Ukeplanen lagres ikke, og navn på barna sendes ikke. Legg inn klasse per barn under Innstillinger i KI-fanen.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 27,
    delnummer: 1,
    navn: "Fiol",
    dato: "2026-10-08",
    tittel: "Annenhver uke, ryddigere ferdig-liste og nye navn",
    endringer: [
      {
        tekst:
          "Et gjøremål kan nå komme tilbake annenhver uke. Da hopper det over en hel uke etter at det er godkjent.",
      },
      {
        tekst:
          "Gjøremål som er ferdige og godkjent, står nå nederst som en liten, rolig liste. Da er det lett å se forskjell på dem og de som er ledige eller tatt.",
      },
      {
        tekst:
          "Foreldre kan endre navn på alle i familien, også sitt eget, under Familie og «Endre navn».",
        for: "voksne",
      },
      {
        tekst:
          "Nye regler for versjonsnumrene: store nye funksjoner får et helt nytt nummer, og mindre fikser får et tall bak komma, som 27.1.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 27,
    navn: "Fiol",
    dato: "2026-10-07",
    tittel: "Lekser etter barn, og justeringer for besteforeldre",
    endringer: [
      {
        tekst:
          "Leksene på Hjem står nå alltid sortert etter barn, så hvert barns lekser står samlet under dagen.",
      },
      {
        tekst:
          "Farmor og farfar kan nå henge opp lapper på oppslagstavla. De kan bare endre og ta ned lappene de selv har skrevet.",
      },
      {
        tekst:
          "Besteforeldrene har ikke lenger Middag-fanen. Hva det er til middag, ser de på Hjem.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 26,
    navn: "Eføy",
    dato: "2026-10-07",
    tittel: "Lekser får egen overskrift",
    endringer: [
      {
        tekst:
          "Under hver dag på Hjem står leksene nå under en egen liten overskrift, «Lekser». Da er det lett å se forskjell på leksene og det som står i kalenderen.",
      },
    ],
  },
  {
    nummer: 25,
    navn: "Dahlia",
    dato: "2026-10-07",
    tittel: "Plass til besteforeldre",
    endringer: [
      {
        tekst:
          "Nå kan Farmor og farfar være med på tavla. De ser det som står på Hjem, gjøremålene og middagene, og de kan legge inn gjøremål til dere og godkjenne dem selv.",
      },
      {
        tekst:
          "Et gjøremål fra besteforeldrene kan gi opptil 30 poeng. Når du har gjort det, er det besteforeldrene som sier at det er bra nok.",
      },
      {
        tekst:
          "Du velger rolle «Besteforeldre» når du lager en bruker under Familie. De ser ikke handlelista, kalenderfanen eller Familie, og de kan ikke endre noe annet enn sine egne gjøremål. Leksene ser de bare under «De neste dagene», og kan ikke krysse av.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 24,
    navn: "Calluna",
    dato: "2026-10-07",
    tittel: "Lekser",
    endringer: [
      {
        tekst:
          "Ny fane: Lekser. Her ser du leksene dine og krysser av i en boks når du har gjort dem.",
      },
      {
        tekst:
          "Leksene dukker også opp under «De neste dagene», på dagen de skal være gjort. Der kan du krysse av uten å gå inn i fanen. Er en lekse ikke gjort, står den på dagens kort til du har gjort den.",
      },
      {
        tekst:
          "Du ser bare dine egne lekser. De voksne ser leksene til alle barna og kan også krysse av.",
      },
      {
        tekst:
          "Du legger inn en lekse for ett eller flere barn på en gang, med fag og frist. Du kan endre eller slette den i fanen og rett fra «De neste dagene».",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 23,
    navn: "Bjørk",
    dato: "2026-10-07",
    tittel: "Gjøremål og avtaler som kommer igjen",
    endringer: [
      {
        tekst:
          "Noen gjøremål kommer tilbake av seg selv. Når en voksen har godkjent det, dukker det opp igjen neste dag, neste uke eller neste måned, så du kan ta det på nytt og få flere poeng.",
      },
      {
        tekst:
          "Avtaler kan nå gjentas hver uke, for eksempel trening hver tirsdag. Da trenger ingen å legge den inn på nytt hver gang.",
      },
      {
        tekst: "Nå er det bare barna som gir middagen stjerner. De voksne ser snittet.",
      },
      {
        tekst:
          "Når du lager et gjøremål, velger du selv om det bare skal gjøres én gang eller komme tilbake. Gjøremål som hviler, ligger under «Kommer igjen».",
        for: "voksne",
      },
      {
        tekst:
          "Endrer eller sletter du en avtale som gjentas, gjelder det alle ukene. Du velger siste dag den gjentas, og den kan gå opptil to år.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 22,
    navn: "Anemone",
    dato: "2026-10-07",
    tittel: "Lettere å lese og bruke for alle",
    endringer: [
      {
        tekst:
          "Grå tekst og små tall er litt mørkere, så de er lettere å lese. Gjøremål som er godkjent, er ikke lenger bleke, men står tydelig.",
      },
      {
        tekst:
          "Flere knapper er blitt litt større, så de er lettere å treffe, for eksempel fargerundingene og knappene på lappene.",
      },
      {
        tekst:
          "Kalenderen forteller nå skjermlesere hva som ligger på hver dag. Du kan holde pekeren over en dag for å se hvilke avtaler det er.",
      },
      {
        tekst: "Knappene på en lapp du skriver, er lette å se også når telefonen er i mørk modus.",
      },
      {
        tekst:
          "Du kan bruke tastaturet overalt: en «Hopp til innholdet»-lenke kommer først når du trykker Tab, og boksen som spør hva som skal på handlelisten, holder fokuset inni seg og setter det tilbake når den lukkes.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 21,
    navn: "Villrein",
    dato: "2026-10-07",
    tittel: "De neste dagene i uke-stil, og grå skyer",
    endringer: [
      {
        tekst:
          "«De neste dagene» på Hjem viser nå dagene fra i dag og ut uka, til og med søndag. På en søndag er det bare søndagen. Hver dag ligger i et eget hvitt kort, også dagene uten avtaler.",
      },
      {
        tekst:
          "Ukevisningen «Uke 41» under er fjernet fra Hjem, så det er bare én liste over dagene som kommer.",
      },
      {
        tekst:
          "Alle skyene i værmeldingen er grå. Regnet er blått, solen er gul, lynet er gult, og snøen er blågrå.",
      },
    ],
  },
  {
    nummer: 20,
    navn: "Ugle",
    dato: "2026-10-07",
    tittel: "Bevegelse",
    endringer: [
      {
        tekst:
          "Når du bytter fane, toner skjermen rolig inn, og kortene og listene stiger litt opp, ett etter ett.",
      },
      {
        tekst:
          "Meldinger og bokser som dukker opp, glir mykt inn. Boksen som spør hva som skal på handlelisten, vokser frem.",
      },
      {
        tekst:
          "Kort du kan trykke på, løfter seg litt når du holder musepekeren over, og trykkes litt ned når du trykker. Innloggingsfliser løfter seg også.",
      },
      {
        tekst:
          "Har du bedt iPaden om mindre bevegelse (under Tilgjengelighet i Innstillinger), står alt stille.",
      },
    ],
  },
  {
    nummer: 19,
    navn: "Tiur",
    dato: "2026-10-07",
    tittel: "Ukevisning på Hjem",
    endringer: [
      {
        tekst:
          "Hjem har fått en ukevisning nederst, under «De neste dagene». Hver dag i uka ligger i et eget hvitt kort med middag og avtaler, og du kan bla til forrige og neste uke.",
      },
      {
        tekst:
          "Kalenderen viser nå bare måneden. Ukevisningen er flyttet til Hjem, så den også er der for barna.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 18,
    navn: "Sel",
    dato: "2026-10-06",
    tittel: "Stjerner i middagsvelgeren",
    endringer: [
      {
        tekst:
          "Når middagen velges for en dag, står snittet igjen med en stjerne, for eksempel «Tacofredag (★ 4,3)», i stedet for «4 av 5».",
      },
    ],
  },
  {
    nummer: 17,
    navn: "Rev",
    dato: "2026-10-06",
    tittel: "PIN med 4 sifre, og middag som beveger seg",
    endringer: [
      {
        tekst:
          "Alle PIN-koder har 4 sifre, også for voksne. Innloggingen viser derfor alltid fire sirkler, og du logges inn med en gang det fjerde sifferet er tastet.",
      },
      {
        tekst:
          "Middagsikonet på Hjem beveger seg litt når du åpner Hjem, og når du trykker på middagen for å gi stjerner.",
      },
      {
        tekst:
          "Når navnet på middagen er så langt at det går over to linjer, holder ikonet nå samme størrelse.",
      },
      {
        tekst:
          "Har du en PIN med 5 eller 6 sifre fra før, kan du bytte den til 4 sifre under «Meg». Nye PIN-koder må ha 4 sifre.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 16,
    navn: "Panda",
    dato: "2026-10-06",
    tittel: "Nytt utseende på alle skjermene",
    endringer: [
      {
        tekst:
          "Nå har alle skjermene i appen fått det nye utseendet: innloggingen, Meg og Hva er nytt. Overalt er emojiene (utenom bildene av oss) byttet mot enkle ikoner.",
      },
      {
        tekst:
          "På innloggingen er knappen for å slette et siffer et enkelt ikon, og «Hei, Elias» har ikke lenger utropstegn.",
      },
      {
        tekst:
          "Meldinger som kommer når du har gjort noe, flytter seg til synlig sted på skjermen, så du ikke går glipp av dem.",
      },
      {
        tekst:
          "Kalenderen har fått nye knapper og skjema. Boksen «Hele dagen» er en rund boks der haken tegnes inn, og fargevalget viser en hake på fargen du har valgt.",
        for: "voksne",
      },
      {
        tekst:
          "Under Familie ser du hvem som er forelder eller barn som små merker, og du kan se hvilken farge som er valgt.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 15,
    navn: "Oter",
    dato: "2026-10-06",
    tittel: "Nytt utseende på Middag",
    endringer: [
      {
        tekst:
          "Middag har fått nye ikoner i stedet for emojier og stjerner som tegn. Stjernene er gylne, og scoren din vises med en stjerne ved siden av tallet.",
      },
      {
        tekst:
          "Boksen som spør hva som skal på handlelisten, har fått runde bokser med animert hake, og knappen har en liten handlevogn.",
        for: "voksne",
      },
      {
        tekst: "Bytt uke med nye pilknapper, og velg mellom Ukeplan og Retter med ikoner.",
        for: "voksne",
      },
      {
        tekst: "Skjemaet for å lage og endre retter har fått nytt utseende.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 14,
    navn: "Nesehorn",
    dato: "2026-10-06",
    tittel: "Nytt utseende på Handle",
    endringer: [
      {
        tekst:
          "Handlelista har fått nye ikoner i stedet for emojier. Rutene er blitt runde bokser, og når du huker av en vare, tegnes haken inn med en liten animasjon.",
      },
      {
        tekst:
          "Når lista er tom, står det en handlevogn der som beveger seg litt. Forslagene du får når du skriver, har et klokkeikon.",
      },
      {
        tekst: "Knappene og meldingene i handlelista har fått nytt utseende.",
      },
    ],
  },
  {
    nummer: 13,
    navn: "Måke",
    dato: "2026-10-06",
    tittel: "Nytt utseende på Gjøremål",
    endringer: [
      {
        tekst:
          "Gjøremål har fått nye ikoner i stedet for emojier: en hånd på «Jeg tar den», en hake på «Ferdig» og en klokke når noe venter på godkjenning. De beveger seg litt når du trykker.",
      },
      {
        tekst:
          "Poengene vises med en gylden stjerne, og kortene har fått nye farger: grønt for ledig, gult for tatt, grått-blått for det som venter på godkjenning.",
      },
      {
        tekst: "Været har fått nye farger: overskyet er mørk grå, og alt med regn er blått.",
      },
      {
        tekst: "Skjemaet for å lage et gjøremål har fått nytt utseende.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 12,
    navn: "Lemen",
    dato: "2026-10-06",
    tittel: "Nytt utseende og bevegelse på Hjem",
    endringer: [
      {
        tekst:
          "Hjem har fått nye, enkle ikoner: været, blyanten og søppelkassa på lappene, og stedet på avtalene.",
      },
      {
        tekst:
          "Ikonene beveger seg! Trykk på en knapp i menyen nederst, så spiller ikonet en liten animasjon. Været ruller også inn når du åpner Hjem, og du kan trykke på en dag for å se det igjen.",
      },
      { tekst: "Solen i værmeldingen er gul." },
      {
        tekst:
          "Værmeldingen er ryddet: teksten om hvor været kommer fra er borte, så det blir mer plass til selve været.",
      },
      {
        tekst:
          "Stjernene til middagen er blitt gylne, og du ser hvor mange du ga som fem små stjerner.",
      },
    ],
  },
  {
    nummer: 11,
    navn: "Kenguru",
    dato: "2026-10-06",
    tittel: "Nye ikoner i menyen",
    endringer: [
      {
        tekst:
          "Menyen nederst har fått nye, enkle ikoner i stedet for emojier. Den har fortsatt fargen din.",
      },
      {
        tekst:
          "Øverst ser du bildet og navnet ditt. Trykk på det, så kommer du rett til profilen din.",
      },
      {
        tekst:
          "Meldingene som dukker opp når noe går galt, eller når noe er gjort, har fått et nytt utseende med et lite ikon.",
      },
    ],
  },
  {
    nummer: 10,
    navn: "Jerv",
    dato: "2026-10-06",
    tittel: "Ny skrift og nye farger",
    endringer: [
      {
        tekst:
          "Appen har fått ny skrift og nye, rolige farger i grønt. Dette er første steg mot et nytt utseende for hele appen.",
      },
      {
        tekst: "Knappene er blitt litt større og runde, så det er lettere å treffe dem på iPaden.",
      },
      {
        tekst:
          "Profilfargene kommer nå fra en egen fargepalett: grønn, salvie, sand, leire og skifer. Fargene du hadde fra før, er flyttet til den nærmeste i paletten.",
      },
    ],
  },
  {
    nummer: 9,
    navn: "Isbjørn",
    dato: "2026-10-06",
    tittel: "Hva er nytt, og farge på menyen",
    endringer: [
      {
        tekst:
          "Under «Meg» finner du nå «Hva er nytt», med alt som har kommet i appen, fra første versjon.",
      },
      {
        tekst:
          "Hver versjon har et nummer og et dyrenavn, så det er lett å se hvilken versjon du bruker.",
      },
      {
        tekst:
          "Menyen nederst har samme farge som profilbildet ditt, så du ser med en gang at du er logget inn som deg.",
      },
    ],
  },
  {
    nummer: 8,
    navn: "Hare",
    dato: "2026-10-06",
    tittel: "Middagsretter og stjerner",
    endringer: [
      {
        tekst:
          "Trykk på dagens middag på Hjem og gi den fra 1 til 5 stjerner. Når retten serveres igjen, kan du stemme på nytt.",
      },
      {
        tekst:
          "Under «Middag» ser du alle middagene vi har, hvor mange stjerner de har fått, og hva du selv ga dem.",
      },
      {
        tekst:
          "Handlelisten har fått et notat i grå skrift under hver vare, som alle kan skrive og endre.",
      },
      {
        tekst:
          "Voksne har faste middagsretter med tittel, notat og ingredienser, sortert etter hvor mange stjerner de har.",
        for: "voksne",
      },
      {
        tekst:
          "Ukeplanen lages ved å velge en rett fra listen. Ingrediensene legges på handlelisten, og i notatet står det når de må handles innen.",
        for: "voksne",
      },
      {
        tekst:
          "En boks lar deg fjerne ingredienser du ikke vil kjøpe før resten legges på handlelisten.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 7,
    navn: "Gaupe",
    dato: "2026-10-06",
    tittel: "Hjem og emoji",
    endringer: [
      { tekst: "Fanen «Tavle» heter nå «Hjem»." },
      {
        tekst:
          "Under oppslagstavla står de neste dagene nedover i en liste, med middag og avtaler.",
      },
      { tekst: "Du kan bytte emoji på profilen din under «Meg»." },
      {
        tekst: "Kalenderen er nå bare for voksne. Barna ser det de trenger på Hjem.",
        for: "voksne",
      },
      { tekst: "Middagen vises sammen med avtalene i kalenderen.", for: "voksne" },
      {
        tekst: "Rettet en feil der «Lagre» manglet når man endret navn eller farge på en kalender.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 6,
    navn: "Frosk",
    dato: "2026-10-06",
    tittel: "Kalender, handleliste og middag",
    endringer: [
      {
        tekst:
          "Handleliste der alle kan legge til varer og krysse av. Varer du har handlet før dukker opp som forslag mens du skriver.",
      },
      { tekst: "Middagsplan for uka, så alle kan se hva det er til middag." },
      { tekst: "Kalender med måned og uke, med uketall og én farge per kalender.", for: "voksne" },
      {
        tekst: "Bare voksne kan slette varer fra handlelisten og legge inn avtaler.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 5,
    navn: "Elg",
    dato: "2026-10-06",
    tittel: "Vær",
    endringer: [
      {
        tekst:
          "Været for de neste sju dagene står over oppslagstavla, med data fra Meteorologisk institutt.",
      },
      {
        tekst:
          "Tavla, gjøremål og poengene oppdaterer seg selv hvert tiende sekund, så du ser endringer fra andre nesten med en gang.",
      },
    ],
  },
  {
    nummer: 4,
    navn: "Delfin",
    dato: "2026-10-06",
    tittel: "Gjøremål og poeng",
    endringer: [
      { tekst: "Barn kan ta et gjøremål. Når noen har tatt det, kan ingen andre ta det." },
      {
        tekst: "Trykk «Ferdig!» når du har gjort det. En voksen godkjenner, og så får du poengene.",
      },
      { tekst: "På profilen din ser du poengene du har, og de som venter på godkjenning." },
      {
        tekst:
          "Voksne legger inn gjøremål med poeng, godkjenner og kan si at noe ikke er ferdig ennå.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 3,
    navn: "Cheetah",
    dato: "2026-10-06",
    tittel: "Oppslagstavle",
    endringer: [
      { tekst: "Oppslagstavle med post-it-lapper. Alle kan sette opp en lapp i fem farger." },
      { tekst: "Du kan endre og slette dine egne lapper. Voksne kan endre og slette alle." },
    ],
  },
  {
    nummer: 2,
    navn: "Bever",
    dato: "2026-10-05",
    tittel: "Innlogging",
    endringer: [
      {
        tekst: "Velg deg selv på startskjermen og tast PIN-koden din. Appen husker deg i 30 dager.",
      },
      { tekst: "Tastet du feil PIN fem ganger, må du vente fem minutter før du kan prøve igjen." },
      { tekst: "Du kan bytte din egen PIN under «Meg»." },
      {
        tekst: "Voksne kan legge til familiemedlemmer, nullstille PIN og deaktivere brukere.",
        for: "voksne",
      },
    ],
  },
  {
    nummer: 1,
    navn: "Alke",
    dato: "2026-10-05",
    tittel: "Første versjon",
    endringer: [
      { tekst: "Familietavla ble født: en nettapp som kjører hjemme hos oss på en liten server." },
      { tekst: "Den har lyst og mørkt utseende som følger telefonen eller iPaden." },
    ],
  },
];

/** Nummeret slik det vises: «27» for en hovedversjon og «27.1» for en mindre fiks. */
export const versjonsnummer = (v: Pick<Versjon, "nummer" | "delnummer">): string =>
  v.delnummer ? `${v.nummer}.${v.delnummer}` : String(v.nummer);

/** Den nyeste versjonen, som er den som kjører nå. */
export const gjeldendeVersjon: Versjon = versjoner[0]!;
