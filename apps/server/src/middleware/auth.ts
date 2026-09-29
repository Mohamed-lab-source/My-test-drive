import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function extractUserId(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  const token = header.slice("Bearer ".length);
  try {
    return verifyToken(token).userId;
  } catch {
    return undefined;
  }
}

/** Attaches req.userId when a valid token is present, but never blocks the request. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.userId = extractUserId(req);
  next();
}

/** Requires a valid token; responds 401 otherwise. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = extractUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  req.userId = userId;
  next();
}
