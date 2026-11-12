import { ApiError } from "../errors/api-error.js";

import {
  extractedActivitySchema,
  type ExtractRequest,
  type ExtractResponse,
} from "../contracts/extracts.js";

import {
  buildExtractionMessages,
} from "../prompts/extract.prompts.js";

import type {
  StructuredGenerator,
} from "../ai/openRouter-structured.js";

export interface ExtractorService {
  extract(
    input: ExtractRequest
  ): Promise<ExtractResponse>;
}

export function createExtractorService(
  generator: StructuredGenerator,
  defaultModel: string
): ExtractorService {

  return {
    async extract(
      input: ExtractRequest
    ): Promise<ExtractResponse> {

      // 1. Seleccionar modelo.
      const model = input.model ?? defaultModel;

      if (!model) {
        throw new ApiError(
          503,
          "MODEL_NOT_CONFIGURED",
          "No existe un modelo configurado"
        );
      }

      // 2. Construir mensajes.
      const messages = buildExtractionMessages(
        input.text
      );

      // 3. Solicitar generación.
      const generation = await generator.generate({
        model,
        mode: input.mode,
        messages,
      });

      // 4. Interpretar el JSON.
      let rawData: unknown;

      try {
        rawData = JSON.parse(generation.content);
      } catch {
        throw new ApiError(
          502,
          "MODEL_INVALID_JSON",
          "El modelo devolvió JSON inválido"
        );
      }

      // 5. Validar el contrato de salida.
      const validated =
        extractedActivitySchema.safeParse(
          rawData
        );

      if (!validated.success) {
        throw new ApiError(
          502,
          "MODEL_SCHEMA_VIOLATION",
          "La respuesta no cumple el contrato"
        );
      }

      // 6. Construir respuesta final.
      return {
        model: generation.model,
        mode: input.mode,
        data: validated.data,
        usage: generation.usage,
      };
    },
  };
}