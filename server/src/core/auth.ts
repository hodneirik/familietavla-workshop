import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import type { Db } from "../db/client.js";
import { HttpError } from "./errors.js";

/** Foreldre styrer alt. Barna har egne oppgaver. Besteforeldre ser, og kan bare legge til og godkjenne egne gjøremål. */
export type Rolle = "forelder" | "barn" | "besteforelder";

export interface AuthUser {
  id: number;
  visningsnavn: string;
  rolle: Rolle;
  farge: string;
  emoji: string | null;
}

export const SESSION_COOKIE = "sid";
export const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;
const RENEW_AFTER_MS = 3_600_000;

export function createSession(db: Db, userId: number, enhet: string | undefined): string {
  const id = randomBytes(32).toString("hex");
  const now = new Date();
  db.prepare(
    "INSERT INTO sessions (id, user_id, opprettet, sist_brukt, utloper, enhet) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    userId,
    now.toISOString(),
    now.toISOString(),
    new Date(now.getTime() + SESSION_DAYS * DAY_MS).toISOString(),
    enhet?.slice(0, 200) ?? null,
  );
  return id;
}

export function destroySession(db: Db, id: string): void {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
}

export function destroyUserSessions(db: Db, userId: number): void {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

/** Finner innlogget bruker for en økt. Fornyer økten ved bruk (rullerende 30 dager). */
export function lookupSession(db: Db, id: string, now = new Date()): AuthUser | null {
  const row = db
    .prepare(
      `SELECT s.sist_brukt, u.id, u.visningsnavn, u.rolle, u.farge, u.emoji
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.utloper > ? AND u.aktiv = 1`,
    )
    .get(id, now.toISOString()) as
    | {
        sist_brukt: string;
        id: number;
        visningsnavn: string;
        rolle: Rolle;
        farge: string;
        emoji: string | null;
      }
    | undefined;
  if (!row) return null;
  if (now.getTime() - new Date(row.sist_brukt).getTime() > RENEW_AFTER_MS) {
    db.prepare("UPDATE sessions SET sist_brukt = ?, utloper = ? WHERE id = ?").run(
      now.toISOString(),
      new Date(now.getTime() + SESSION_DAYS * DAY_MS).toISOString(),
      id,
    );
  }
  return {
    id: row.id,
    visningsnavn: row.visningsnavn,
    rolle: row.rolle,
    farge: row.farge,
    emoji: row.emoji,
  };
}

export function loadUser(db: Db): RequestHandler {
  return (req, _res, next) => {
    const sid: unknown = req.signedCookies?.[SESSION_COOKIE];
    if (typeof sid === "string") {
      const user = lookupSession(db, sid);
      if (user) {
        req.user = user;
        req.sessionId = sid;
      }
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new HttpError(401, "Du må logge inn");
  next();
};

export function requireRolle(rolle: Rolle): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw new HttpError(401, "Du må logge inn");
    if (req.user.rolle !== rolle) throw new HttpError(403, "Bare foreldre kan gjøre dette");
    next();
  };
}

/**
 * Besteforeldre kan se, men ikke endre. Det eneste som slippes gjennom, er innlogging og egen profil
 * (/api/auth), gjøremål (/api/gjoremal) og oppslagstavla (/api/oppslag), der tjenesten selv sjekker at
 * de bare endrer det de selv har laget. Handlelista og listen over middagsretter (Middag-fanen) er
 * ikke for dem. Dette er en ekstra sperre oppå reglene i hver tjeneste.
 */
export const begrensBesteforeldre: RequestHandler = (req, _res, next) => {
  if (req.user?.rolle !== "besteforelder") return next();
  const lesing = req.method === "GET" || req.method === "HEAD";
  const sti = req.path;
  if (sti.startsWith("/handleliste"))
    throw new HttpError(403, "Handlelista er ikke for besteforeldre");
  if (sti.startsWith("/middag/retter"))
    throw new HttpError(403, "Middagsrettene er ikke for besteforeldre");
  const egne = ["/auth", "/gjoremal", "/oppslag"];
  if (!lesing && !egne.some((e) => sti.startsWith(e))) {
    throw new HttpError(403, "Besteforeldre kan bare se");
  }
  next();
};
