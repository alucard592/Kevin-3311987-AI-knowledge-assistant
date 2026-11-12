import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const openapi = JSON.parse(
  readFileSync(resolve(process.cwd(), "docs", "openapi.json"), "utf8")
);

describe("contrato OpenAPI módulo 2", () => {
    it("conserva las rutas base", () => {
    expect(openapi.paths["/health"]).toBeDefined();
    expect(openapi.paths["/api/v1/ask"]).toBeDefined();
  });

  it("incluye las rutas del módulo 2", () => {
    const module2 = JSON.parse(
      readFileSync(resolve(process.cwd(), "docs", "module2.openapi.json"), "utf8")
    );

    for (const path of Object.keys(module2.paths)) {
      expect(openapi.paths[path]).toBeDefined();
    }
  });
});