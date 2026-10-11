import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import type { Logger } from "./logger.js";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ feil: "Fant ikke siden" });
};

export function errorHandler(log: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ feil: err.message });
      return;
    }
    if (err instanceof ZodError) {
      res.status(400).json({ feil: "Ugyldig inndata" });
      return;
    }
    const status = (err as { status?: unknown }).status;
    if (status === 400 || status === 413) {
      res.status(status).json({ feil: "Ugyldig forespørsel" });
      return;
    }
    log.error("Uventet feil", {
      sti: req.path,
      feil: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ feil: "Noe gikk galt" });
  };
}
