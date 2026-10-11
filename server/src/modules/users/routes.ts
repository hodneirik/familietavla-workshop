import { Router } from "express";
import { z } from "zod";
import { destroyUserSessions, requireRolle } from "../../core/auth.js";
import { PROFILFARGER } from "../../core/profilfarger.js";
import type { AppDeps } from "../../app.js";
import { createUser, getUser, listUsers, setPin, updateUser } from "./service.js";

const rolle = z.enum(["forelder", "barn", "besteforelder"]);
const navn = z.string().trim().min(1).max(40);
const farge = z.enum(PROFILFARGER);
const emoji = z.string().max(16).nullable();

const nyBruker = z.object({
  visningsnavn: navn,
  rolle,
  farge: farge.optional(),
  emoji: emoji.optional(),
  pin: z.string(),
});
const endring = z.object({
  visningsnavn: navn.optional(),
  rolle: rolle.optional(),
  farge: farge.optional(),
  emoji: emoji.optional(),
  aktiv: z.boolean().optional(),
});
const idParam = z.coerce.number().int().positive();

/** Alt her er forelder-only. */
export function usersRouter({ db }: AppDeps): Router {
  const router = Router();
  router.use(requireRolle("forelder"));

  router.get("/", (_req, res) => {
    res.json(listUsers(db, false));
  });

  router.post("/", (req, res) => {
    const bruker = createUser(db, nyBruker.parse(req.body), req.user!.id);
    res.status(201).json(bruker);
  });

  router.patch("/:id", (req, res) => {
    res.json(updateUser(db, idParam.parse(req.params.id), endring.parse(req.body), req.user!.id));
  });

  router.post("/:id/reset-pin", (req, res) => {
    const id = idParam.parse(req.params.id);
    const { pin } = z.object({ pin: z.string() }).parse(req.body);
    getUser(db, id);
    setPin(db, id, pin, req.user!.id, "pin_nullstilt");
    // Mistet telefon eller glemt PIN: alle gamle økter for brukeren avsluttes
    if (id !== req.user!.id) destroyUserSessions(db, id);
    res.json({ ok: true });
  });

  return router;
}
