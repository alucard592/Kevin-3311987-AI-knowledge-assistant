import { Router } from 'express';

import {
  createAskController
} from '../controllers/ask.controller.js';

import type {
  AssistantService
} from '../services/assistant.service.js';

export function createAskRoutes(
  assistantService: AssistantService
): Router {

  const router = Router();

  const controller = createAskController(
    assistantService
  );

  router.post(
    '/',
    controller
  );

  return router;
}