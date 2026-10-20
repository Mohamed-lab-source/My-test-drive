import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { forwardErrors } from "./asyncRouter";

const req = {} as Request;
const res = {} as Response;

describe("forwardErrors", () => {
  it("passes a rejected promise to next instead of leaving it unhandled", async () => {
    const next = vi.fn() as unknown as NextFunction;
    const failure = new Error("database unreachable");
    forwardErrors(async () => {
      throw failure;
    })(req, res, next);
    await new Promise((r) => setImmediate(r));
    expect(next).toHaveBeenCalledWith(failure);
  });

  it("passes a synchronous throw to next", () => {
    const next = vi.fn() as unknown as NextFunction;
    forwardErrors(() => {
      throw new Error("boom");
    })(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("leaves successful handlers alone", async () => {
    const next = vi.fn() as unknown as NextFunction;
    forwardErrors(async () => "ok")(req, res, next);
    await new Promise((r) => setImmediate(r));
    expect(next).not.toHaveBeenCalled();
  });
});
