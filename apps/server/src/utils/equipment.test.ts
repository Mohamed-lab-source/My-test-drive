import { describe, expect, it } from "vitest";
import { detectEquipment } from "./equipment";

describe("detectEquipment", () => {
  it("finds the oven and tray for a bake", () => {
    expect(detectEquipment(["Spread on a baking sheet and bake for 20 minutes."])).toEqual(["oven", "tray"]);
  });

  it("does not mistake a baking pan for a frying pan", () => {
    const keys = detectEquipment(["Pour the batter into a greased baking pan."]);
    expect(keys).toContain("tray");
    expect(keys).not.toContain("pan");
  });

  it("detects stovetop tools across steps", () => {
    const keys = detectEquipment(["Chop the onion.", "Fry it in a pan.", "Boil the pasta and drain."]);
    expect(keys).toEqual(expect.arrayContaining(["knife", "pan", "pot", "strainer"]));
  });

  it("returns nothing for steps without tool hints", () => {
    expect(detectEquipment(["Serve and enjoy."])).toEqual([]);
  });
});
