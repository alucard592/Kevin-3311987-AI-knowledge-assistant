import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number()
    .int()
    .min(1)
    .max(65535)
    .default(3000),

  AI_EXECUTION_MODE: z.enum([
    'mock',
    'openrouter'
  ]).default('mock'),

  REQUEST_TIMEOUT_MS: z.coerce.number()
    .int()
    .min(1000)
    .max(120000)
    .default(15000),

  OPENROUTER_API_KEY: z.string().optional(),

  OPENROUTER_MODEL: z.string().optional()
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(
  source: NodeJS.ProcessEnv = process.env
): AppConfig {

  const config = envSchema.parse(source);

  if (config.AI_EXECUTION_MODE === 'openrouter') {

    if (
      !config.OPENROUTER_API_KEY ||
      !config.OPENROUTER_MODEL
    ) {
      throw new Error(
        'Debes configurar OPENROUTER_API_KEY y OPENROUTER_MODEL.'
      );
    }
  }

  return config;
}