import { randomUUID } from 'node:crypto';

import { readFileSync } from 'node:fs';

import { resolve } from 'node:path';

import express from 'express';

import swaggerUi from 'swagger-ui-express';

import type { AppConfig } from './config/env.js';

import {
  ApiError
} from './errors/api-errors.js';

import {
  errorHandler
} from './middlewares/error-handler.js';

import {
  createAskRoutes
} from './routes/ask.routes.js';

import {
  createHealthRoutes
} from './routes/health.routes.js';

import {
  createAssistantService,
  type AssistantService
} from './services/assistant.service.js';

// Construir la aplicación HTTP

export function createApp(
  config: AppConfig,
  assistantService: AssistantService = createAssistantService(config)
) {

  const app = express();

  // Ocultar cabecera informativa del framework

  app.disable('x-powered-by');

  // Crear identificador para cada solicitud

  app.use((_req, res, next) => {

    const requestId = randomUUID();

    res.locals.requestId = requestId;

    res.setHeader(
      'X-Request-Id',
      requestId
    );

    next();
  });

  // Interpretar solicitudes JSON

  app.use(
    express.json({
      limit: '16kb'
    })
  );

  // Registrar endpoints funcionales

  app.use(
    '/health',
    createHealthRoutes(config)
  );

  app.use(
    '/api/v1/ask',
    createAskRoutes(assistantService)
  );

  // Cargar la especificación OpenAPI

  const openApiPath = resolve(
    process.cwd(),
    'docs',
    'openapi.json'
  );

  const openApiDocument: unknown = JSON.parse(
    readFileSync(openApiPath, 'utf8')
  );

  // Exponer especificación JSON

  app.get('/openapi.json', (_req, res) => {

    res.status(200).json(openApiDocument);

  });

  // Interfaz interactiva Swagger UI

  app.use(
    '/docs',
    swaggerUi.serve,
   swaggerUi.setup(openApiDocument as Record<string, any>)
  );

  // Manejar rutas que no existen

  app.use((_req, _res, next) => {

    next(
      new ApiError(
        404,
        'NOT_FOUND',
        'La ruta solicitada no existe.'
      )
    );

  });

  // Manejo centralizado de errores

  app.use(errorHandler);

  return app;
}