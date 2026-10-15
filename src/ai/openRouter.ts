import { z } from 'zod';

import type { AppConfig } from '../config/env.js';
import type { InferenceResult } from '../contracts/ask.js';

import { ApiError } from '../errors/api-error.js';

const listedModel = z.object({
  id: z.string(),

  pricing: z.object({
    prompt: z.string(),
    completion: z.string(),
    request: z.string(),
  }),

  architecture: z.object({
    input_modalities: z.array(z.string()),
    output_modalities: z.array(z.string()),
  }),
});

const chatReply = z.object({
  model: z.string().optional(),

  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable().optional(),
      }),
    })
  ),

  usage: z.object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
  }).optional(),
});

export function isVerifiedFreeTextModel(
  raw: unknown,
  selectedId: string
): boolean {

  const parsed = listedModel.safeParse(raw);

  if (!parsed.success) {
    return false;
  }

  const model = parsed.data;

  const prices = [
    model.pricing.prompt,
    model.pricing.completion,
    model.pricing.request,
  ];

  return (
    model.id === selectedId &&
    selectedId.endsWith(':free') &&

    prices.every(
      price =>
        price.trim() !== '' &&
        Number.isFinite(Number(price)) &&
        Number(price) === 0
    ) &&

    model.architecture.input_modalities.includes('text') &&
    model.architecture.output_modalities.includes('text')
  );
}

async function fetchJSON(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<unknown> {

  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {

      if (response.status === 429) {
        throw new ApiError(
          503,
          'UPSTREAM_RATE_LIMIT',
          'Cuota del proveedor agotada.'
        );
      }

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        throw new ApiError(
          503,
          'UPSTREAM_AUTH',
          'El proveedor rechazó las credenciales.'
        );
      }

      throw new ApiError(
        503,
        'UPSTREAM_UNAVAILABLE',
        'El proveedor no está disponible.'
      );
    }

    return await response.json() as unknown;

  } catch (error) {

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      503,
      'UPSTREAM_UNAVAILABLE',
      'No se pudo contactar al proveedor.'
    );
  }
}

export async function verifyFreeModel(
  config: AppConfig
): Promise<string> {

  const key = config.OPENROUTER_API_KEY;
  const model = config.OPENROUTER_MODEL;

  if (
    !key ||
    !model ||
    !model.endsWith(':free')
  ) {
    throw new ApiError(
      503,
      'FREE_MODEL_REQUIRED',
      'Configura una variante gratuita explícita.'
    );
  }

  const catalog = await fetchJSON(
    'https://openrouter.ai/api/v1/models',
    {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    },
    config.REQUEST_TIMEOUT_MS
  );

  const catalogResult = z.object({
    data: z.array(z.unknown()),
  }).safeParse(catalog);

  if (!catalogResult.success) {
    throw new ApiError(
      503,
      'MODEL_CATALOG_ERROR',
      'Catálogo inválido.'
    );
  }

  const selected = catalogResult.data.data.find(item => {
    const parsed = z.object({
      id: z.string(),
    }).safeParse(item);

    return (
      parsed.success &&
      parsed.data.id === model
    );
  });

  if (!isVerifiedFreeTextModel(selected, model)) {
    throw new ApiError(
      503,
      'FREE_MODEL_UNAVAILABLE',
      'El modelo no está disponible como gratuito de texto.'
    );
  }

  return model;
}

export async function inferWithOpenRouter(
  question: string,
  config: AppConfig
): Promise<InferenceResult> {

  const model = await verifyFreeModel(config);
  const key = config.OPENROUTER_API_KEY!;

  const raw = await fetchJSON(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        model,

        messages: [
          {
            role: 'user',
            content: question,
          },
        ],

        max_tokens: 180,
        stream: false,
      }),
    },
    config.REQUEST_TIMEOUT_MS
  );

  const result = chatReply.safeParse(raw);

  if (!result.success) {
    throw new ApiError(
      503,
      'INVALID_MODEL_RESPONSE',
      'El proveedor devolvió un formato inesperado.'
    );
  }

  const answer =
    result.data.choices[0]?.message.content?.trim();

  if (!answer) {
    throw new ApiError(
      503,
      'EMPTY_MODEL_RESPONSE',
      'El modelo no produjo texto.'
    );
  }

  const usage = result.data.usage;

  return {
    answer,
    mode: 'openrouter',
    requestedModel: model,
    resolvedModel: result.data.model ?? null,

    usage:
      usage &&
      usage.prompt_tokens !== undefined &&
      usage.completion_tokens !== undefined

        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
          }

        : null,
  };
}