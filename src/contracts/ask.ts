import { z } from 'zod';

// Contrato de entrada

export const askRequestSchema = z.object({
  question: z.string()
    .trim()
    .min(3, 'La pregunta debe tener mínimo 3 caracteres.')
    .max(1000, 'La pregunta no puede superar 1000 caracteres.')
}).strict();

// Tipo TypeScript inferido del contrato

export type AskRequest = z.infer<
  typeof askRequestSchema
>;

// Contrato de salida de la inferencia


export interface AskResult {
  answer: string;
  mode: 'mock' | 'openrouter' | 'local';
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  } | null;
}