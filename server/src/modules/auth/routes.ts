import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { audit } from "../../core/audit.js";
import {
  createSession,
  destroySession,
  requireAuth,
  SESSION_COOKIE,
  SESSION_DAYS,
} from "../../core/auth.js";
import { HttpError } from "../../core/errors.js";
import { verifyPin } from "../../core/pin.js";
import type { AppDeps } from "../../app.js";
import { listUsers, setPin, updateUser } from "../users/service.js";

const MAX_FEIL = 5;
const LAAS_MS = 5 * 60_000;

// Nye PIN-koder er 4 sifre, men innlogging godtar fortsatt eldre koder på opptil 6
const loginSchema = z.object({ userId: z.number().int(), pin: z.string().regex(/^\d{4,6}$/) });
const pinSchema = z.object({ gammel: z.string(), ny: z.string() });

/** Bare emoji: bildetegn, hudtoner, flagg og tegnene som setter sammen sekvenser (som en familie eller et flagg). */
const EMOJI =
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u200D|\uFE0F)+$/u;
const profilSchema = z.object({ emoji: z.string().trim().min(1).max(16).regex(EMOJI) }).strict();

/** Låst hvis de 5 siste forsøkene alle var feil og det siste var for under 5 minutter siden. */
function laastTil(db: AppDeps["db"], userId: number, now: number): number | null {
  const rader = db
    .prepare(
      "SELECT tidspunkt, vellykket FROM auth_attempts WHERE user_id = ? ORDER BY id DESC LIMIT ?",
    )
    .all(userId, MAX_FEIL) as { tidspunkt: string; vellykket: number }[];
  const nyeste = rader[0];
  if (rader.length < MAX_FEIL || !nyeste || rader.some((r) => r.vellykket === 1)) return null;
  const til = new Date(nyeste.tidspunkt).getTime() + LAAS_MS;
  return til > now ? til : null;
}

export function authRouter({ config, db, log }: AppDeps): Router {
  const router = Router();

  // Startskjermen trenger å vise flisene før noen er innlogget. Bare navn, farge og emoji.
  router.get("/users", (_req, res) => {
    res.json(
      listUsers(db, true).map(({ id, visningsnavn, rolle, farge, emoji }) => ({
        id,
        visningsnavn,
        rolle,
        farge,
        emoji,
      })),
    );
  });

  router.post(
    "/login",
    rateLimit({
      windowMs: 5 * 60_000,
      limit: 40,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
    (req, res) => {
      const { userId, pin } = loginSchema.parse(req.body);
      const bruker = db
        .prepare("SELECT id, pin_hash, aktiv FROM users WHERE id = ?")
        .get(userId) as { id: number; pin_hash: string | null; aktiv: number } | undefined;
      if (!bruker || bruker.aktiv !== 1) throw new HttpError(401, "Feil PIN");

      const now = Date.now();
      const til = laastTil(db, bruker.id, now);
      if (til) {
        const min = Math.ceil((til - now) / 60_000);
        throw new HttpError(
          429,
          `For mange feil. Prøv igjen om ${min} ${min === 1 ? "minutt" : "minutter"}`,
        );
      }

      const ok = verifyPin(pin, bruker.pin_hash);
      db.prepare(
        "INSERT INTO auth_attempts (user_id, tidspunkt, ip, vellykket) VALUES (?, ?, ?, ?)",
      ).run(bruker.id, new Date(now).toISOString(), req.ip ?? null, ok ? 1 : 0);
      if (!ok) {
        audit(db, bruker.id, "innlogging_feilet", { ip: req.ip });
        if (laastTil(db, bruker.id, now))
          log.warn("Bruker utestengt etter feil PIN", { userId: bruker.id });
        throw new HttpError(401, "Feil PIN");
      }

      const sid = createSession(db, bruker.id, req.get("user-agent"));
      res.cookie(SESSION_COOKIE, sid, {
        httpOnly: true,
        sameSite: "lax",
        secure: config.COOKIE_SECURE === "auto" ? req.secure : config.COOKIE_SECURE === "true",
        signed: true,
        maxAge: SESSION_DAYS * 86_400_000,
      });
      audit(db, bruker.id, "innlogging", { ip: req.ip });
      res.json({ bruker: listUsers(db, true).find((u) => u.id === bruker.id) });
    },
  );

  router.post("/logout", (req, res) => {
    if (req.sessionId) destroySession(db, req.sessionId);
    if (req.user) audit(db, req.user.id, "utlogging");
    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  });

  router.get("/me", requireAuth, (req, res) => {
    res.json({ bruker: req.user });
  });

  /** Alle kan bytte sin egen emoji, og bare den. Navn, rolle og farge endres av en forelder. */
  router.patch("/me", requireAuth, (req, res) => {
    const parsed = profilSchema.safeParse(req.body);
    if (!parsed.success)
      throw new HttpError(400, "Det må være en emoji, ikke bokstaver eller tall");
    const { emoji } = parsed.data;
    const id = req.user!.id;
    const b = updateUser(db, id, { emoji }, id);
    res.json({
      bruker: {
        id: b.id,
        visningsnavn: b.visningsnavn,
        rolle: b.rolle,
        farge: b.farge,
        emoji: b.emoji,
      },
    });
  });

  router.post("/pin", requireAuth, (req, res) => {
    const { gammel, ny } = pinSchema.parse(req.body);
    const user = req.user!;
    const rad = db.prepare("SELECT pin_hash FROM users WHERE id = ?").get(user.id) as {
      pin_hash: string | null;
    };
    if (!verifyPin(gammel, rad.pin_hash)) throw new HttpError(401, "Feil gammel PIN");
    setPin(db, user.id, ny, user.id);
    res.json({ ok: true });
  });

  return router;
}
