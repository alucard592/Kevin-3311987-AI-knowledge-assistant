import type { ErrorRequestHandler } from 'express';

import { ApiError } from '../errors/api-error.js';

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req,
  res,
  next
) => {
  if (res.headersSent) {
    return next(err);
  }

  const malformedJson =
    err instanceof SyntaxError &&
    'status' in err &&
    err.status === 400;

  const oversized =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    err.status === 413;

  const normalized =
    err instanceof ApiError
      ? err
      : malformedJson
        ? new ApiError(
            400,
            'INVALID_JSON',
            'El JSON enviado no es válido.'
          )
        : oversized
          ? new ApiError(
              413,
              'PAYLOAD_TOO_LARGE',
              'El cuerpo excede el límite permitido.'
            )
          : new ApiError(
              500,
              'INTERNAL_ERROR',
              'Error interno.'
            );

  console.error(JSON.stringify({
    event: 'request_failed',
    code: normalized.code,
    requestId: res.locals.requestId
  }));

  res.status(normalized.statusCode).json({
    error: {
      code: normalized.code,
      message: normalized.message,
      requestId: String(res.locals.requestId)
    }
  });
};