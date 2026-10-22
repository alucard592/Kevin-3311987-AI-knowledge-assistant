import type { ErrorRequestHandler } from 'express';

import { ApiError } from '../errors/api-errors.js';

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next
) => {

  if (res.headersSent) {
    return next(error);
  }

  const invalidJson =
    error instanceof SyntaxError &&
    'status' in error &&
    error.status === 400;

  const oversizedBody =
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 413;

  let normalized: ApiError;

  if (error instanceof ApiError) {

    normalized = error;

  } else if (invalidJson) {

    normalized = new ApiError(
      400,
      'INVALID_JSON',
      'El JSON enviado no es válido.'
    );

  } else if (oversizedBody) {

    normalized = new ApiError(
      413,
      'PAYLOAD_TOO_LARGE',
      'El cuerpo de la petición excede el tamaño permitido.'
    );

  } else {

    normalized = new ApiError(
      500,
      'INTERNAL_ERROR',
      'Error interno del servidor.'
    );
  }

  console.error({
    code: normalized.code,
    requestId: res.locals.requestId
  });

  res.status(normalized.statusCode).json({
    error: {
      code: normalized.code,
      message: normalized.message,
      requestId: String(res.locals.requestId)
    }
  });
};