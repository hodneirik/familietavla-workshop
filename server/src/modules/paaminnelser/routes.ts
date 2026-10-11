import { Router } from "express";
import { z } from "zod";
import type { AppDeps } from "../../app.js";
import { requireAuth } from "../../core/auth.js";
import {
  createPaaminnelser,
  deletePaaminnelse,
  listPaaminnelser,
  updatePaaminnelse,
} from "./service.js";

const tittel = z.string().trim().min(1).max(60);
const ukedag = z.number().int().min(0).max(6);
const dato = z.string().max(10);

/**
 * Brukes også av KI-modulen, så forslag valideres med de samme reglene. Enten `ukedager` (fast hver
 * uke, eventuelt bare mellom `fra` og `til`) eller `dato` (én dag), aldri begge.
 */
export const nyPaaminnelse = z
  .object({
    barnIder: z.array(z.number().int().positive()).min(1).max(10),
    tittel,
    ukedager: z.array(ukedag).min(1).max(7).optional(),
    dato: dato.nullish(),
    fra: dato.nullish(),
    til: dato.nullish(),
  })
  .refine((d) => (d.ukedager !== undefined) !== !!d.dato, "Velg enten ukedager eller én dato")
  .refine((d) => !d.dato || (!d.fra && !d.til), "En enkeltdag har ikke periode");
const endring = z.object({
  tittel: tittel.optional(),
  ukedag: ukedag.optional(),
  dato: dato.nullish(),
  fra: dato.nullish(),
  til: dato.nullish(),
});
const idParam = z.coerce.number().int().positive();

/**
 * Barn ser sine egne påminnelser, voksne ser alle barnas. Bare foreldre legger inn, endrer og
 * sletter. Besteforeldre ser dem (leser slipper gjennom), men kan ikke skrive.
 */
export function paaminnelserRouter({ db, naa = Date.now }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/", (req, res) => {
    res.json(listPaaminnelser(db, req.user!, naa()));
  });
  router.post("/", (req, res) => {
    res.status(201).json(createPaaminnelser(db, req.user!, nyPaaminnelse.parse(req.body), naa()));
  });
  router.patch("/:id", (req, res) => {
    res.json(
      updatePaaminnelse(db, req.user!, idParam.parse(req.params.id), endring.parse(req.body)),
    );
  });
  router.delete("/:id", (req, res) => {
    deletePaaminnelse(db, req.user!, idParam.parse(req.params.id));
    res.status(204).end();
  });

  return router;
}
