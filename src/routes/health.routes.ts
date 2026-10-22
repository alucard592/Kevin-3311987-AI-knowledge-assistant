import { Router } from 'express';

import type { AppConfig } from '../config/env.js';

export function createHealthRoutes(
  config: AppConfig
): Router {

  const router = Router();

  router.get('/', (_req, res) => {

    res.status(200).json({
      status: 'ok',
      mode: config.AI_EXECUTION_MODE
    });
  });

  return router;
}