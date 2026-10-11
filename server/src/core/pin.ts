import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 32;

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string | null): boolean {
  // Gjør alltid like mye arbeid, også når brukeren mangler PIN, så svartiden ikke røper noe
  const [scheme, saltHex, hashHex] = (stored ?? "scrypt$00$00").split("$");
  const salt = Buffer.from(saltHex ?? "", "hex");
  const expected = Buffer.from(hashHex ?? "", "hex");
  const actual = scryptSync(pin, salt, KEYLEN);
  return (
    stored !== null &&
    scheme === "scrypt" &&
    expected.length === KEYLEN &&
    timingSafeEqual(actual, expected)
  );
}

/** Nye PIN-koder er nøyaktig 4 sifre, for både barn og voksne. */
export function pinErGyldig(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
