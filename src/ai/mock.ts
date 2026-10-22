import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import type { AskResult } from '../contracts/ask.js';

// Validación del archivo mock

const fixtureSchema = z.object({
  model: z.string().min(1),
  answer: z.string().min(1)
});

// Generador de respuesta simulada

export async function generateMockAnswer(): Promise<AskResult> {

  const filePath = resolve(
    process.cwd(),
    'fixtures',
    'mock-response.json'
  );

  const content = readFileSync(
    filePath,
    'utf8'
  );

  const raw: unknown = JSON.parse(content);

  const fixture = fixtureSchema.parse(raw);

  return {
    answer: fixture.answer,
    mode: 'mock',
    model: fixture.model,
    resolvedModel: fixture.model,
    usage: null
  };
}