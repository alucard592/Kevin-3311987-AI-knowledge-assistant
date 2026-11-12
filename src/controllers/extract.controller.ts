import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { ApiError } from "../errors/api-error.js";

import {
  extractRequestSchema,
} from "../contracts/extracts.js";

import type {
  ExtractorService,
} from "../services/extract.services.js";

export function createExtractController(
  service: ExtractorService
) {

  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {

    try {
      // Validar el cuerpo recibido.
      const parsed = extractRequestSchema.safeParse(
        req.body
      );

      if (!parsed.success) {
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "La solicitud no cumple el contrato de entrada"
        );
      }

      // Ejecutar el caso de uso.
      const result = await service.extract(
        parsed.data
      );

      // Responder al cliente.
      res.status(200).json(result);

    } catch (error) {
      // Delegar al middleware existente.
      next(error);
    }
  };
}