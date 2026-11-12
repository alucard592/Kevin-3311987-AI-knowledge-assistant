import {
  describe,
  it,
  expect,
} from "vitest";

import {
  extractRequestSchema,
  extractedActivitySchema,
} from "../src/contracts/extracts.js";

const validActivity = {
  title: "Crear una API REST",
  summary: "Desarrollar una API con Express",
  topics: ["Express", "TypeScript"],
  difficulty: "media",
  estimatedHours: 5,
  deadline: "2026-11-20",
};

describe("Módulo II - Contratos Zod", () => {

  it("acepta una solicitud válida", () => {
    const result = extractRequestSchema.safeParse({
      text: "Desarrollar una API REST con Express.",
      mode: "structured",
    });

    expect(result.success).toBe(true);
  });

  it("usa structured por defecto", () => {
    const result = extractRequestSchema.parse({
      text: "Construir una API con Express y TypeScript.",
    });

    expect(result.mode).toBe("structured");
  });

  it("rechaza textos demasiado cortos", () => {
    const result = extractRequestSchema.safeParse({
      text: "Hola",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza modos desconocidos", () => {
    const result = extractRequestSchema.safeParse({
      text: "Desarrollar una API REST con Express.",
      mode: "modo_inexistente",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza propiedades adicionales", () => {
    const result = extractRequestSchema.safeParse({
      text: "Desarrollar una API REST con Express.",
      secret: "dato-no-permitido",
    });

    expect(result.success).toBe(false);
  });

  it("acepta una extracción estructurada válida", () => {
    const result = extractedActivitySchema.safeParse(
      validActivity
    );

    expect(result.success).toBe(true);
  });

  it("rechaza horas representadas como texto", () => {
    const result = extractedActivitySchema.safeParse({
      ...validActivity,
      estimatedHours: "cinco",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza fechas inexistentes", () => {
    const result = extractedActivitySchema.safeParse({
      ...validActivity,
      deadline: "2026-02-30",
    });

    expect(result.success).toBe(false);
  });

  it("acepta datos desconocidos con null", () => {
    const result = extractedActivitySchema.safeParse({
      ...validActivity,
      estimatedHours: null,
      deadline: null,
    });

    expect(result.success).toBe(true);
  });
});