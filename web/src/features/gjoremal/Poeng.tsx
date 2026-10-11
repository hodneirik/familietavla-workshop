import { Ikon } from "../../design/Ikon";
import type { Poengstatus } from "../../lib/types";

/** Poengene til ett barn: det som er godkjent, og det som ligger klart til godkjenning. */
export function PoengKort({ status, navn }: { status: Poengstatus; navn?: boolean }) {
  const { bruker, poeng, klare } = status;
  return (
    <div className="poengkort" style={{ borderColor: bruker.farge }}>
      {navn && (
        <span className="poengnavn">
          {bruker.emoji ?? "🙂"} {bruker.visningsnavn}
        </span>
      )}
      <strong className="poengsum">
        <Ikon navn="stjerne" storrelse="l" fylt className="stjerne" /> {poeng} poeng
      </strong>
      {klare > 0 && (
        <span className="poengklare">
          <Ikon navn="klokke" storrelse="s" /> +{klare} venter på godkjenning
        </span>
      )}
    </div>
  );
}
