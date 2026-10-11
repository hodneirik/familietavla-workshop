/**
 * Hvilken versjon av appen som er lastet, og hvilken som ligger på serveren. Vite gir hver bygging
 * nye filnavn (`/assets/index-ABC123.js`), så navnet på hovedskriptet i `index.html` er et
 * pålitelig versjonsmerke uten at serveren må gjøre noe ekstra.
 */
const SKRIPT = /<script[^>]*\bsrc="(\/assets\/[^"]+\.js)"/;

/** Hovedskriptet i en `index.html`, eller null hvis siden ikke er appen (for eksempel en innloggingsside). */
export function skriptFraHtml(html: string): string | null {
  return SKRIPT.exec(html)?.[1] ?? null;
}

/** Hovedskriptet denne siden ble lastet med. Null i utvikling, så sjekken da er av. */
export function lastetSkript(dok: Document = document): string | null {
  const el = dok.querySelector<HTMLScriptElement>('script[type="module"][src^="/assets/"]');
  return el?.getAttribute("src") ?? null;
}

/**
 * Sjekker om serveren har en nyere versjon. Gir false ved alt som er usikkert: ingen nett, serveren
 * er midt i en oppdatering, eller svaret er ikke appen. Da prøver vi igjen senere.
 */
export async function harNyVersjon(
  hent: typeof fetch = fetch,
  lastet: string | null = lastetSkript(),
): Promise<boolean> {
  if (!lastet) return false;
  try {
    const res = await hent("/", { cache: "no-store", headers: { Accept: "text/html" } });
    if (!res.ok) return false;
    const paaServer = skriptFraHtml(await res.text());
    return paaServer !== null && paaServer !== lastet;
  } catch {
    return false;
  }
}
