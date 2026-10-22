import { z } from 'zod';

import type { AppConfig } from '../config/env.ts';

import type { AskResult } from '../contracts/ask.js';

import { ApiError } from '../errors/api-errors.js';

// 1. Contrato de un modelo del catálogo

const modelSchema = z.object({
  id: z.string(),

  pricing: z.object({
    prompt: z.string(),
    completion: z.string(),
    request: z.string().optional()
  }),

  architecture: z.object({
    input_modalities: z.array(z.string()),
    output_modalities: z.array(z.string())
  })
});

// 2. Contrato del catálogo

const catalogSchema = z.object({
  data: z.array(z.unknown())
});

// 3. Contrato de una respuesta del LLM

const completionSchema = z.object({
  model: z.string().optional(),

  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullish()
      })
    })
  ).min(1),

  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number()
  }).optional()
});

// 4. Comprobar si una tarifa es cero

function isZeroPrice(value: string): boolean {

  return (
    value.trim() !== '' &&
    Number.isFinite(Number(value)) &&
    Number(value) === 0
  );
}

// 5. Comprobar modelo gratuito de texto

export function isVerifiedFreeTextModel(
  raw: unknown,
  selectedId: string
): boolean {

  const parsed = modelSchema.safeParse(raw);

  if (!parsed.success) {
    return false;
  }

  const model = parsed.data;

  // El catálogo omite "request" cuando no hay cargo por solicitud.
  const prices = [
    model.pricing.prompt,
    model.pricing.completion,
    ...(model.pricing.request === undefined
      ? []
      : [model.pricing.request])
  ];

  return (
    model.id === selectedId &&

    selectedId.endsWith(':free') &&

    prices.every(isZeroPrice) &&

    model.architecture.input_modalities.includes('text') &&

    model.architecture.output_modalities.includes('text')
  );
}

// 6. Función HTTP reutilizable

async function requestJson(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<unknown> {

  let response: Response;

  try {

    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs)
    });

  } catch {

    throw new ApiError(
      503,
      'UPSTREAM_NETWORK_ERROR',
      'No fue posible conectar con OpenRouter.'
    );
  }

  if (response.status === 429) {

    throw new ApiError(
      503,
      'UPSTREAM_RATE_LIMIT',
      'OpenRouter ha alcanzado el límite de solicitudes.'
    );
  }

  if (
    response.status === 401 ||
    response.status === 403
  ) {

    throw new ApiError(
      503,
      'UPSTREAM_AUTH_ERROR',
      'OpenRouter rechazó las credenciales.'
    );
  }

  if (!response.ok) {

    throw new ApiError(
      503,
      'UPSTREAM_ERROR',
      'OpenRouter no pudo procesar la solicitud.'
    );
  }

  try {

    return await response.json() as unknown;

  } catch {

    throw new ApiError(
      503,
      'UPSTREAM_INVALID_JSON',
      'OpenRouter devolvió un JSON inválido.'
    );
  }
}

// 7. Verificar el modelo antes de generar

export async function verifyFreeModel(
  config: AppConfig
): Promise<string> {

  const modelId = config.OPENROUTER_MODEL;
  const apiKey = config.OPENROUTER_API_KEY;

  if (
    !apiKey ||
    !modelId ||
    !modelId.endsWith(':free')
  ) {

    throw new ApiError(
      503,
      'FREE_MODEL_REQUIRED',
      'Debes seleccionar un modelo gratuito explícito.'
    );
  }

  const rawCatalog = await requestJson(
    'https://openrouter.ai/api/v1/models',
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    },
    config.REQUEST_TIMEOUT_MS
  );

  const parsedCatalog = catalogSchema.safeParse(
    rawCatalog
  );

  if (!parsedCatalog.success) {

    throw new ApiError(
      503,
      'INVALID_MODEL_CATALOG',
      'No se pudo validar el catálogo de modelos.'
    );
  }

  const selectedModel = parsedCatalog.data.data.find(
    (item) => {

      const parsed = z.object({
        id: z.string()
      }).safeParse(item);

      return (
        parsed.success &&
        parsed.data.id === modelId
      );
    }
  );

  if (
    !isVerifiedFreeTextModel(
      selectedModel,
      modelId
    )
  ) {

    throw new ApiError(
      503,
      'FREE_MODEL_UNAVAILABLE',
      'No se confirmó un modelo gratuito compatible con texto.'
    );
  }

  return modelId;
}

// 8. Realizar la inferencia

export async function generateOpenRouterAnswer(
  question: string,
  config: AppConfig
): Promise<AskResult> {

  // Primero verificamos el modelo

  const model = await verifyFreeModel(config);

  const apiKey = config.OPENROUTER_API_KEY!;

  // Construimos la solicitud HTTP

  const rawResponse = await requestJson(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        model: model,

        messages: [
          {
            role: 'system',
            content:
              'Eres un asistente educativo. Responde en español de forma clara y breve.'
          },
          {
            role: 'user',
            content: question
          }
        ],

        max_tokens: 200,
        stream: false
      })
    },
    config.REQUEST_TIMEOUT_MS
  );

  // Validamos la respuesta

  const parsed = completionSchema.safeParse(
    rawResponse
  );

  if (!parsed.success) {

    throw new ApiError(
      503,
      'INVALID_MODEL_RESPONSE',
      'La respuesta de OpenRouter tiene un formato inválido.'
    );
  }

  const answer =
    parsed.data.choices[0]?.message.content?.trim();

  if (!answer) {

    throw new ApiError(
      503,
      'EMPTY_MODEL_RESPONSE',
      'El modelo no generó contenido de texto.'
    );
  }

  // Construimos la respuesta para nuestra API

  return {
    answer,
    mode: 'openrouter',
    model: parsed.data.model ?? model,

    usage: parsed.data.usage
      ? {
          promptTokens:
            parsed.data.usage.prompt_tokens,

          completionTokens:
            parsed.data.usage.completion_tokens
        }
      : null
  };
}