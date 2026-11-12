import { z } from "zod";

import { ApiError } from "../errors/api-error.js";

import {
  activityJsonSchema,
  type ExtractionMode,
  type ExtractUsage,
} from "../contracts/extracts.js";

import type {
  PromptMessage,
} from "../prompts/extract.prompts.js";

// Contrato de entrada a OpenRouter.
export interface StructuredGenerationInput {
  model: string;
  mode: ExtractionMode;
  messages: PromptMessage[];
}

// Contrato de respuesta del proveedor.
export interface StructuredGenerationResult {
  content: string;
  model: string;
  usage: ExtractUsage | null;
}

// Contrato para sustituir el transporte en pruebas.
export interface StructuredGenerator {
  generate(
    input: StructuredGenerationInput
  ): Promise<StructuredGenerationResult>;
}

type FetchFunction = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

export interface OpenRouterStructuredConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetcher?: FetchFunction;
}

// Esquema de los metadatos del catálogo.
const modelCatalogSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),

      pricing: z.object({
        prompt: z.union([
          z.string(),
          z.number(),
        ]),

        completion: z.union([
          z.string(),
          z.number(),
        ]),
      }),

      supported_parameters:
        z.array(z.string()).optional(),

      architecture: z.object({
        input_modalities:
          z.array(z.string()).optional(),

        output_modalities:
          z.array(z.string()).optional(),
      }).optional(),
    })
  ),
});

// Esquema mínimo de una respuesta de inferencia.
const completionSchema = z.object({
  choices: z.array(
    z.object({
      finish_reason:
        z.string().nullable().optional(),

      message: z.object({
        content:
          z.string().nullable().optional(),
      }),
    })
  ).min(1),

  usage: z.object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
    total_tokens: z.number().optional(),
  }).nullable().optional(),
});

export class OpenRouterStructuredClient
  implements StructuredGenerator {

  constructor(
    private readonly config: OpenRouterStructuredConfig
  ) {}

  private get baseUrl(): string {
    return (
      this.config.baseUrl ??
      "https://openrouter.ai/api/v1"
    ).replace(/\/+$/, "");
  }

  private async request(
    path: string,
    options: RequestInit = {}
  ): Promise<unknown> {

    if (!this.config.apiKey.trim()) {
      throw new ApiError(
        503,
        "OPENROUTER_NOT_CONFIGURED",
        "No se configuró OPENROUTER_API_KEY"
      );
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, this.config.timeoutMs ?? 30000);

    try {
      const fetcher = this.config.fetcher ?? fetch;

      const response = await fetcher(
        `${this.baseUrl}${path}`,
        {
          ...options,

          headers: {
            Authorization:
              `Bearer ${this.config.apiKey}`,

            "Content-Type": "application/json",
          },

          signal: controller.signal,
        }
      );

      let data: unknown;

      try {
        data = await response.json();
      } catch {
        throw new ApiError(
          502,
          "OPENROUTER_INVALID_RESPONSE",
          "OpenRouter devolvió una respuesta no JSON"
        );
      }

      if (!response.ok) {
        if (response.status === 429) {
          throw new ApiError(
            503,
            "OPENROUTER_RATE_LIMIT",
            "OpenRouter alcanzó el límite de solicitudes"
          );
        }

        throw new ApiError(
          502,
          "OPENROUTER_UPSTREAM_ERROR",
          `OpenRouter respondió con HTTP ${response.status}`
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new ApiError(
          504,
          "OPENROUTER_TIMEOUT",
          "Se agotó el tiempo de espera"
        );
      }

      throw new ApiError(
        502,
        "OPENROUTER_NETWORK_ERROR",
        "No fue posible contactar OpenRouter"
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async verifyFreeModel(
    modelId: string,
    mode: ExtractionMode
  ): Promise<void> {

    if (!modelId.endsWith(":free")) {
      throw new ApiError(
        422,
        "FREE_ONLY",
        "Solo se permiten modelos con sufijo :free"
      );
    }

    const rawCatalog = await this.request("/models");

    const parsed = modelCatalogSchema.safeParse(
      rawCatalog
    );

    if (!parsed.success) {
      throw new ApiError(
        502,
        "INVALID_MODEL_CATALOG",
        "No fue posible validar el catálogo"
      );
    }

    const model = parsed.data.data.find(
      (item) => item.id === modelId
    );

    if (!model) {
      throw new ApiError(
        422,
        "MODEL_NOT_FOUND",
        "El modelo no existe en el catálogo"
      );
    }

    const promptPrice =
      Number(model.pricing.prompt);

    const completionPrice =
      Number(model.pricing.completion);

    if (
      !Number.isFinite(promptPrice) ||
      !Number.isFinite(completionPrice) ||
      promptPrice !== 0 ||
      completionPrice !== 0
    ) {
      throw new ApiError(
        422,
        "MODEL_NOT_FREE",
        "El modelo no tiene costo cero verificado"
      );
    }

    const inputModalities =
      model.architecture?.input_modalities ?? [];

    const outputModalities =
      model.architecture?.output_modalities ?? [];

    if (
      !inputModalities.includes("text") ||
      !outputModalities.includes("text")
    ) {
      throw new ApiError(
        422,
        "INCOMPATIBLE_MODALITY",
        "El modelo no admite texto de entrada y salida"
      );
    }

    const params =
      model.supported_parameters ?? [];

    if (
      mode === "structured" &&
      !params.includes("structured_outputs")
    ) {
      throw new ApiError(
        422,
        "STRUCTURED_OUTPUT_UNSUPPORTED",
        "El modelo no declara soporte estructurado"
      );
    }

    if (
      mode === "json_mode" &&
      !params.includes("response_format") &&
      !params.includes("structured_outputs")
    ) {
      throw new ApiError(
        422,
        "JSON_MODE_UNSUPPORTED",
        "No se pudo verificar soporte JSON Mode"
      );
    }
  }

  async generate(
    input: StructuredGenerationInput
  ): Promise<StructuredGenerationResult> {

    await this.verifyFreeModel(
      input.model,
      input.mode
    );

    const responseFormat =
      input.mode === "structured"
        ? {
            type: "json_schema",

            json_schema: {
              name: "educational_activity",
              strict: true,
              schema: activityJsonSchema,
            },
          }
        : {
            type: "json_object",
          };

    const body = {
      model: input.model,
      messages: input.messages,

      response_format: responseFormat,

      provider: {
        require_parameters: true,
      },

      max_tokens: 600,
      stream: false,
    };

    const rawCompletion = await this.request(
      "/chat/completions",
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    const parsed = completionSchema.safeParse(
      rawCompletion
    );

    if (!parsed.success) {
      throw new ApiError(
        502,
        "INVALID_LLM_RESPONSE",
        "La respuesta del proveedor es inválida"
      );
    }

    const choice = parsed.data.choices[0];

if (!choice) {
  throw new ApiError(
    502,
    "INVALID_LLM_RESPONSE",
    "El proveedor no devolvió ninguna opción"
  );
}

if (choice.finish_reason === "length") {
      throw new ApiError(
        502,
        "TRUNCATED_LLM_RESPONSE",
        "La generación terminó antes de completarse"
      );
    }

    const content = choice.message.content;

    if (typeof content !== "string") {
      throw new ApiError(
        502,
        "EMPTY_LLM_RESPONSE",
        "El modelo no devolvió contenido válido"
      );
    }

    const usage = parsed.data.usage;

    return {
      content,
      model: input.model,

      usage: usage
        ? {
            promptTokens:
              usage.prompt_tokens ?? null,

            completionTokens:
              usage.completion_tokens ?? null,

            totalTokens:
              usage.total_tokens ?? null,
          }
        : null,
    };
  }
}