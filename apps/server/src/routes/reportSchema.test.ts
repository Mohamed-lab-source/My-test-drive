import { describe, expect, it } from "vitest";
import { reportBodySchema } from "./recipes";

describe("reportBodySchema", () => {
  it("accepts a known reason with optional details", () => {
    expect(reportBodySchema.safeParse({ reason: "WRONG_STEPS" }).success).toBe(true);
    const parsed = reportBodySchema.parse({ reason: "TRANSLATION", details: "  step 3 is in English  " });
    expect(parsed.details).toBe("step 3 is in English");
  });

  it("rejects unknown reasons and over-long details", () => {
    expect(reportBodySchema.safeParse({ reason: "SPAM" }).success).toBe(false);
    expect(reportBodySchema.safeParse({ reason: "OTHER", details: "x".repeat(501) }).success).toBe(false);
  });
});
