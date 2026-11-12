import express from "express";

import request from "supertest";

import {
  describe,
  it,
  expect,
  vi,
} from "vitest";

import {
  createExtractRouter,
} from "../src/routes/extract.routes.js";

import {
  errorHandler,
} from "../src/middlewares/error-handler.js";

import type {
  ExtractorService,
} from "../src/services/extract.services.js";

const validResult = {
  model: "test/model:free",
  mode: "structured" as const,

  data: {
    title: "Crear una API",
    summary: "Desarrollar una API con Express",
    topics: ["Express"],
    difficulty: "media" as const,
    estimatedHours: 4,
    deadline: null,
  },

  usage: null,
};

function buildTestApp(
  service: ExtractorService
) {
  const app = express();

  app.use(express.json());

  app.use(
    "/api/v1/extract",
    createExtractRouter(service)
  );

  app.use(errorHandler);

  return app;
}

describe("Módulo II - API HTTP", () => {

  it("responde 200 con una extracción válida", async () => {
    const service: ExtractorService = {
      extract: vi.fn().mockResolvedValue(
        validResult
      ),
    };

    const app = buildTestApp(service);

    const response = await request(app)
      .post("/api/v1/extract")
      .send({
        text: "Desarrollar una API REST con Express.",
        mode: "structured",
      });

    expect(response.status).toBe(200);

    expect(response.body.data.title).toBe(
      "Crear una API"
    );

    expect(service.extract)
      .toHaveBeenCalledOnce();
  });

  it("responde 400 cuando el texto es inválido", async () => {
    const service: ExtractorService = {
      extract: vi.fn(),
    };

    const app = buildTestApp(service);

    const response = await request(app)
      .post("/api/v1/extract")
      .send({
        text: "Hola",
      });

    expect(response.status).toBe(400);

    expect(response.body.error.code).toBe(
      "VALIDATION_ERROR"
    );

    expect(service.extract)
      .not.toHaveBeenCalled();
  });

  it("rechaza un modo desconocido", async () => {
    const service: ExtractorService = {
      extract: vi.fn(),
    };

    const app = buildTestApp(service);

    const response = await request(app)
      .post("/api/v1/extract")
      .send({
        text: "Desarrollar una API REST con Express.",
        mode: "modo_invalido",
      });

    expect(response.status).toBe(400);
  });

  it("aplica structured por defecto", async () => {
    const service: ExtractorService = {
      extract: vi.fn().mockResolvedValue(
        validResult
      ),
    };

    const app = buildTestApp(service);

    await request(app)
      .post("/api/v1/extract")
      .send({
        text: "Desarrollar una API REST con Express.",
      });

    expect(service.extract)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "structured",
        })
      );
  });
});
