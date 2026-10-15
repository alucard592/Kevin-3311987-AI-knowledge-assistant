import { randomUUID } from 'node:crypto';

import express from 'express';

import type { AppConfig } from './config/env.js';
import { loadConfig } from './config/env.js';

import { generateAnswer } from './ai/inference.js';

import { ApiError } from './errors/api-error.js';

import {
  errorHandler
} from './middlewares/error-handler.js';

import {
  askRouter,
  type Generator
} from './routes/ask.js';

import {
  healthRouter
} from './routes/health.js';

export function createApp(
  config: AppConfig = loadConfig(),
  generate: Generator = generateAnswer
) {

  const app = express();

  app.disable('x-powered-by');

  // Identificador único para cada solicitud

  app.use((_req, res, next) => {

    const requestId = randomUUID();

    res.locals.requestId = requestId;

    res.setHeader(
      'X-Request-Id',
      requestId
    );

    next();
  });

  // Interpretar cuerpos JSON

  app.use(
    express.json({
      limit: '16kb'
    })
  );

  // Registrar rutas

  app.use(
    '/health',
    healthRouter(config)
  );

  app.use(
    '/api/v1/ask',
    askRouter(config, generate)
  );

  // Manejar rutas inexistentes

  app.use((_req, _res, next) => {
    next(
      new ApiError(
        404,
        'NOT_FOUND',
        'Ruta inexistente.'
      )
    );
  });

  // Middleware centralizado de errores

  app.use(errorHandler);

  return app;
}