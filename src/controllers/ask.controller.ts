import type { RequestHandler } from 'express';

import {
  askRequestSchema
} from '../contracts/ask.js';

import {
  ApiError
} from '../errors/api-errors.js';

import type {
  AssistantService
} from '../services/assistant.service.ts';

// Fábrica de controlador

export function createAskController(
  assistantService: AssistantService
): RequestHandler {

  return async (req, res) => {

    // 1. Validar el JSON recibido

    const validation = askRequestSchema.safeParse(
      req.body
    );

    if (!validation.success) {

      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'La pregunta enviada no es válida.'
      );
    }

    // 2. Obtener el campo validado

    const question = validation.data.question;

    // 3. Solicitar respuesta al servicio

    const result = await assistantService(
      question
    );

    // 4. Construir respuesta HTTP

    res.status(200).json({
      data: result,

      meta: {
        requestId: String(
          res.locals.requestId
        )
      }
    });
  };
}