import { Infoboks } from "../../design/Infoboks";
import { KiInnstillinger } from "./KiInnstillinger";
import { KiStatus } from "./KiStatus";
import { useKi } from "./useKi";

/** KI under Innstillinger (bare foreldre): hva KI-en har kostet denne måneden, og de faste opplysningene den får. */
export function KiOppsett() {
  const ki = useKi();
  return (
    <section className="kioppsett" aria-label="KI">
      <KiStatus status={ki.status} />
      {ki.feil && <Infoboks type="feil">{ki.feil}</Infoboks>}
      {ki.innst && <KiInnstillinger innst={ki.innst} onLagre={ki.lagreInnstillinger} />}
    </section>
  );
}
