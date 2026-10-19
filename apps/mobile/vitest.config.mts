import { defineConfig } from "vitest/config";

// Unit tests cover the pure helpers (src/utils, src/data) and the bundled
// recipe catalog (src/api/localCatalog) -- anything that needs React Native or
// native modules is exercised in the app itself.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
