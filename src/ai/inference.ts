import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import type { AppConfig } from '../config/env.js';
import type { InferenceResult } from '../contracts/ask.js';

import { ApiError } from '../errors/api-error.js';

import { inferWithOpenRouter } from './openrouter.js';

const fixtureSchema = z.object({
  answer: z.string().min(1),
  model: z.string().min(1),
});

const ollamaReply = z.object({
  model: z.string(),

  message: z.object({
    content: z.string(),
  }),

  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional(),
});

export async function generateAnswer(
  question: string,
  config: AppConfig
): Promise<InferenceResult> {

  // MODO 1: respuesta simulada

  if (config.AI_EXECUTION_MODE === 'mock') {

    const fixture = fixtureSchema.parse(
      JSON.parse(
        readFileSync(
          join(
            process.cwd(),
            'fixtures',
            'mock-response.json'
          ),
          'utf8'
        )
      ) as unknown
    );

    return {
      answer: fixture.answer,
      mode: 'mock',
      requestedModel: fixture.model,
      resolvedModel: fixture.model,
      usage: null,
    };
  }

  // MODO 2: OpenRouter

  if (config.AI_EXECUTION_MODE === 'openrouter') {
    return inferWithOpenRouter(question, config);
  }

  // MODO 3: Ollama local

  try {
    const response = await fetch(
      new URL('/api/chat', config.OLLAMA_BASE_URL),
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        signal: AbortSignal.timeout(
          config.REQUEST_TIMEOUT_MS
        ),

        body: JSON.stringify({
          model: config.OLLAMA_MODEL,
          stream: false,

          messages: [
            {
              role: 'user',
              content: question,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Ollama no disponible.');
    }

    const parsed = ollamaReply.safeParse(
      await response.json() as unknown
    );

    if (
      !parsed.success ||
      !parsed.data.message.content.trim()
    ) {
      throw new Error('Respuesta inválida o vacía.');
    }

    return {
      answer: parsed.data.message.content,
      mode: 'local',

      requestedModel: config.OLLAMA_MODEL!,
      resolvedModel: parsed.data.model,

      usage:
        parsed.data.prompt_eval_count !== undefined &&
        parsed.data.eval_count !== undefined

          ? {
              promptTokens: parsed.data.prompt_eval_count,
              completionTokens: parsed.data.eval_count,
            }

          : null,
    };

  } catch {
    throw new ApiError(
      503,
      'LOCAL_MODEL_UNAVAILABLE',
      'Ollama o el modelo local no están disponibles.'
    );
  }
}