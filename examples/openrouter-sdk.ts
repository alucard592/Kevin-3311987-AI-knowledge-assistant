export async function verifyFreeModel(
  config: AppConfig
): Promise<string> {
  const key = config.OPENROUTER_API_KEY;
  const model = config.OPENROUTER_MODEL;

  if (!key || !model || !model.endsWith(':free')) {
    throw new ApiError(
      503,
      'FREE_MODEL_REQUIRED',
      'Configura una variante gratuita explícita.'
    );
  }

  // Aquí se consulta el catálogo oficial.
  // Se verifican precios y modalidades.
  // Si no se confirma gratuidad, no hay inferencia.

  // La implementación completa está en openrouter.ts.
}