import { Router } from 'express';

import type { AppConfig } from '../config/env.js';

import {
  askRequestSchema,
  type InferenceResult,
} from '../contracts/ask.js';

import { ApiError } from '../errors/api-error.js';

export type Generator = (
  question: string,
  config: AppConfig
) => Promise<InferenceResult>;

export function askRouter(
  config: AppConfig,
  generate: Generator
): Router {

  const router = Router();

  router.post('/', async (req, res) => {

    const parsed = askRequestSchema.safeParse(
      req.body
    );

    if (!parsed.success) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'La pregunta debe tener entre 3 y 1000 caracteres.'
      );
    }

    const result = await generate(
      parsed.data.question,
      config
    );

    res.status(200).json({
      data: result,

      meta: {
        requestId: String(
          res.locals.requestId
        ),
      },
    });
  });

  return router;
}