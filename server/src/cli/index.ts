import { parseArgs } from "node:util";
import { loadConfig } from "../config.js";
import { gjenopprett, lagBackup } from "../db/backup.js";
import { DEMO_BRUKERE, seedDemo } from "../db/demo.js";
import { openDb } from "../db/client.js";
import { migrate } from "../db/migrate.js";
import { createUser, listUsers, setPin } from "../modules/users/service.js";
import { destroyUserSessions } from "../core/auth.js";

try {
  process.loadEnvFile?.("../.env");
} catch {
  // Ingen .env-fil, bruker miljøvariabler
}

const bruk = `Bruk:
  add-user --navn <navn> --rolle <forelder|barn|besteforelder> [--farge #82b797|#b4cdb0|#e6d8b0|#cda89a|#889cb0] [--emoji 🙂] [--pin <pin>]
  reset-pin --id <id> [--pin <pin>]
  list-users
  backup
  seed-demo
  restore --fil <sti til backup>

Utelater du --pin, spør kommandoen om PIN uten å vise den.`;

function spørOmPin(spørsmål: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(spørsmål);
    const stdin = process.stdin;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let pin = "";
    const onData = (tegn: string) => {
      for (const c of tegn) {
        if (c === "\r" || c === "\n" || c === "\u0004") {
          if (stdin.isTTY) stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(pin);
          return;
        }
        if (c === "\u0003") process.exit(130);
        if (c === "\u007f") pin = pin.slice(0, -1);
        else pin += c;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const [kommando, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({
    args: rest,
    options: {
      navn: { type: "string" },
      rolle: { type: "string" },
      farge: { type: "string" },
      emoji: { type: "string" },
      pin: { type: "string" },
      id: { type: "string" },
      fil: { type: "string" },
    },
  });
  const config = loadConfig();

  // Gjenoppretting må gjøres før databasen åpnes, siden den erstatter filen
  if (kommando === "restore") {
    if (!values.fil) {
      console.error(bruk);
      process.exit(1);
    }
    const r = gjenopprett(values.fil, config.DATA_DIR);
    console.log(`Gjenopprettet database med ${r.brukere} brukere.`);
    if (r.reserve) console.log(`Forrige database er tatt vare på som ${r.reserve}`);
    return;
  }

  const db = openDb(config.DATA_DIR);
  migrate(db);

  if (kommando === "seed-demo") {
    seedDemo(db);
    console.log("Demofamilien er lastet inn. Logg inn med:");
    for (const b of DEMO_BRUKERE) console.log(`  ${b.visningsnavn} (${b.rolle}), PIN ${b.pin}`);
  } else if (kommando === "backup") {
    const r = lagBackup(db, config.DATA_DIR);
    console.log(`Backup tatt med ${r.brukere} brukere. Slettet ${r.slettet.length} gamle.`);
    console.log(`BACKUP: ${r.navn}`);
  } else if (kommando === "list-users") {
    for (const u of listUsers(db, false)) {
      console.log(`${u.id}\t${u.visningsnavn}\t${u.rolle}\t${u.aktiv ? "aktiv" : "inaktiv"}`);
    }
  } else if (kommando === "add-user") {
    if (
      !values.navn ||
      (values.rolle !== "forelder" && values.rolle !== "barn" && values.rolle !== "besteforelder")
    ) {
      console.error(bruk);
      process.exit(1);
    }
    const pin = values.pin ?? (await spørOmPin("PIN: "));
    const u = createUser(
      db,
      {
        visningsnavn: values.navn,
        rolle: values.rolle,
        farge: values.farge,
        emoji: values.emoji,
        pin,
      },
      null,
    );
    console.log(`Opprettet ${u.visningsnavn} (id ${u.id}, ${u.rolle})`);
  } else if (kommando === "reset-pin") {
    const id = Number(values.id);
    if (!Number.isInteger(id)) {
      console.error(bruk);
      process.exit(1);
    }
    const pin = values.pin ?? (await spørOmPin("Ny PIN: "));
    setPin(db, id, pin, null, "pin_nullstilt_cli");
    destroyUserSessions(db, id);
    console.log("PIN er nullstilt og brukeren er logget ut overalt.");
  } else {
    console.error(bruk);
    process.exit(1);
  }
  db.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
