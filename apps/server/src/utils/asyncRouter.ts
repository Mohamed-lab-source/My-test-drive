import { Router, type NextFunction, type Request, type Response } from "express";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

const METHODS = ["get", "post", "put", "patch", "delete", "all"] as const;

/** Forwards a rejected promise (or a thrown error) from a handler to Express's error middleware. */
export function forwardErrors(handler: Handler): Handler {
  return (req, res, next) => {
    try {
      const result = handler(req, res, next);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        (result as Promise<unknown>).catch(next);
      }
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Express 4 ignores promises returned by route handlers, so an awaited
 * database call that rejects becomes an unhandled rejection -- and Node
 * exits on those, taking the whole API down for every user. This makes the
 * router's route methods pass such errors to the error middleware instead,
 * which answers that one request with a 500 and keeps the server running.
 */
export function createRouter(): Router {
  const router = Router();
  for (const method of METHODS) {
    const original = router[method].bind(router) as (...args: unknown[]) => Router;
    (router as unknown as Record<string, unknown>)[method] = (path: unknown, ...handlers: unknown[]) =>
      original(
        path,
        // Error middleware (4 args) and non-functions pass through untouched.
        ...handlers.map((h) => (typeof h === "function" && h.length < 4 ? forwardErrors(h as Handler) : h))
      );
  }
  return router;
}
