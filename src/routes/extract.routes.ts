import { Router } from "express";

import {
  createExtractController,
} from "../controllers/extract.controller.js";

import type {
  ExtractorService,
} from "../services/extract.services.js";

export function createExtractRouter(
  service: ExtractorService
): Router {

  const router = Router();

  router.post(
    "/",
    createExtractController(service)
  );

  return router;
}