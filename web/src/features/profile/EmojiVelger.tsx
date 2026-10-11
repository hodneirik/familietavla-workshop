import { useState, type FormEvent } from "react";
import { Tekstfelt } from "../../design/Felt";
import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import { useAuth } from "../../app/AuthContext";
import { apiPatch } from "../../lib/api";
import type { Bruker } from "../../lib/types";

const FORSLAG = [
  "🦖",
  "🦄",
  "🐶",
  "🐱",
  "🦊",
  "🐼",
  "🐸",
  "🦁",
  "🐯",
  "🐵",
  "🐧",
  "🦉",
  "🐢",
  "🐙",
  "🦋",
  "🐝",
  "🐬",
  "🦈",
  "🐉",
  "🚀",
  "⚽",
  "🎮",
  "🎨",
  "🎸",
  "🌈",
  "⭐",
  "🔥",
  "🍕",
  "🍦",
  "🤖",
  "👻",
  "🧔",
];

/** Alle kan bytte sin egen emoji. Et trykk på et forslag lagrer med en gang. */
export function EmojiVelger() {
  const { bruker, oppdaterBruker } = useAuth();
  const [egen, setEgen] = useState("");
  const [opptatt, setOpptatt] = useState(false);
  const [melding, setMelding] = useState<{ tekst: string; feil: boolean } | null>(null);
  if (!bruker) return null;

  const velg = async (emoji: string) => {
    setOpptatt(true);
    setMelding(null);
    try {
      const svar = await apiPatch<{ bruker: Bruker }>("/api/auth/me", { emoji });
      oppdaterBruker(svar.bruker);
      setEgen("");
      setMelding({ tekst: `Nå er du ${emoji}`, feil: false });
    } catch (e) {
      setMelding({
        tekst: e instanceof Error ? e.message : "Noe gikk galt",
        feil: true,
      });
    } finally {
      setOpptatt(false);
    }
  };

  const sendEgen = (e: FormEvent) => {
    e.preventDefault();
    if (egen.trim()) void velg(egen.trim());
  };

  return (
    <section className="emojivelger" aria-label="Velg emoji">
      <div className="emojirutenett" role="radiogroup" aria-label="Emoji å velge mellom">
        {FORSLAG.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={e === bruker.emoji}
            aria-label={e}
            className={e === bruker.emoji ? "valgt" : ""}
            disabled={opptatt}
            onClick={() => void velg(e)}
          >
            {e}
          </button>
        ))}
      </div>
      <form className="egenemoji" onSubmit={sendEgen}>
        <Tekstfelt
          etikett="Eller skriv en egen"
          value={egen}
          onChange={(e) => setEgen(e.target.value)}
          maxLength={16}
          placeholder="Åpne emoji-tastaturet"
        />
        <Knapp type="submit" disabled={opptatt || !egen.trim()}>
          Bruk
        </Knapp>
      </form>
      {melding && (
        <Infoboks key={melding.tekst} type={melding.feil ? "feil" : "ok"}>
          {melding.tekst}
        </Infoboks>
      )}
    </section>
  );
}
