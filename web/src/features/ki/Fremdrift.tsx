/** Viser at KI-en jobber. Teksten leses opp, og stripen står stille hvis man har bedt om mindre bevegelse. */
export function Fremdrift({ tekst }: { tekst: string }) {
  return (
    <div className="kifremdrift" role="status" aria-live="polite" aria-busy="true">
      <span className="kifremdrift__stripe" aria-hidden="true">
        <span />
      </span>
      <p>{tekst}</p>
    </div>
  );
}
