import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../core/auth.js";
import type { AppDeps } from "../../app.js";
import {
  angreGjoremal,
  avvisGjoremal,
  createGjoremal,
  deleteGjoremal,
  fullforGjoremal,
  godkjennGjoremal,
  listGjoremal,
  poengStatus,
  slippGjoremal,
  taGjoremal,
  updateGjoremal,
} from "./service.js";

const tittel = z.string().trim().min(1).max(80);
const poeng = z.number().int().min(0).max(1000);

const gjentas = z.enum(["daglig", "ukentlig", "annenhver_uke", "maanedlig"]).nullable();

const nyttGjoremal = z.object({ tittel, poeng: poeng.default(0), gjentas: gjentas.optional() });
const endring = z.object({
  tittel: tittel.optional(),
  poeng: poeng.optional(),
  gjentas: gjentas.optional(),
});
const idParam = z.coerce.number().int().positive();

/**
 * Alle innloggede kan se gjøremål. Forelder oppretter, endrer, sletter og godkjenner.
 * Barn tar, slipper, melder ferdig og angrer. Reglene håndheves i service.ts.
 */
export function gjoremalRouter({ db, naa = Date.now }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/", (req, res) => {
    res.json(listGjoremal(db, req.user!, naa()));
  });

  router.get("/poeng", (req, res) => {
    res.json(poengStatus(db, req.user!));
  });

  router.post("/", (req, res) => {
    res.status(201).json(createGjoremal(db, req.user!, nyttGjoremal.parse(req.body)));
  });

  router.patch("/:id", (req, res) => {
    res.json(updateGjoremal(db, req.user!, idParam.parse(req.params.id), endring.parse(req.body)));
  });

  router.delete("/:id", (req, res) => {
    deleteGjoremal(db, req.user!, idParam.parse(req.params.id));
    res.status(204).end();
  });

  const handlinger = {
    ta: taGjoremal,
    slipp: slippGjoremal,
    fullfor: fullforGjoremal,
    angre: angreGjoremal,
    godkjenn: godkjennGjoremal,
    avvis: avvisGjoremal,
  };
  for (const [navn, handling] of Object.entries(handlinger)) {
    router.post(`/:id/${navn}`, (req, res) => {
      res.json(handling(db, req.user!, idParam.parse(req.params.id), naa()));
    });
  }

  return router;
}
