import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum([
    'development',
    'test',
    'production'
  ]).default('development'),

  PORT: z.coerce.number()
    .int()
    .min(1)
    .max(65535)
    .default(3000),

  AI_EXECUTION_MODE: z.enum([
    'mock',
    'openrouter',
    'local'
  ]).default('mock'),

  REQUEST_TIMEOUT_MS: z.coerce.number()
    .int()
    .min(1000)
    .max(120000)
    .default(15000),

  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),

  OLLAMA_BASE_URL: z.url()
    .default('http://127.0.0.1:11434'),

  OLLAMA_MODEL: z.string().optional(),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env
): AppConfig {

  const config = schema.parse(env);

  if (config.AI_EXECUTION_MODE === 'openrouter') {
    if (
      !config.OPENROUTER_API_KEY ||
      !config.OPENROUTER_MODEL
    ) {
      throw new Error(
        'Configura OPENROUTER_API_KEY y OPENROUTER_MODEL.'
      );
    }
  }

  if (
    config.AI_EXECUTION_MODE === 'local' &&
    !config.OLLAMA_MODEL
  ) {
    throw new Error(
      'Configura OLLAMA_MODEL para el modo local.'
    );
  }

  if (config.AI_EXECUTION_MODE === 'local') {
    const host = new URL(config.OLLAMA_BASE_URL).hostname;

    if (
      !['localhost', '127.0.0.1', '[::1]'].includes(host)
    ) {
      throw new Error(
        'OLLAMA_BASE_URL debe apuntar a esta misma máquina.'
      );
    }
  }

  return config;
}