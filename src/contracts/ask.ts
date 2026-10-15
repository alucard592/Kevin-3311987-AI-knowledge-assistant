import { z } from 'zod';

export const askRequestSchema = z.object({
  question: z.string()
    .trim()
    .min(3)
    .max(1000),
}).strict();

export type AskRequest =
  z.infer<typeof askRequestSchema>;

export type InferenceResult = {
  answer: string;

  mode: 'mock' | 'openrouter' | 'local';

  requestedModel: string;

  resolvedModel: string | null;

  usage: {
    promptTokens: number;
    completionTokens: number;
  } | null;
};