
import type { AppConfig } from '../config/env.js';

import type { AskResult } from '../contracts/ask.js';

import {
  generateMockAnswer
} from '../ai/mock.js';

import {
  generateOpenRouterAnswer
} from '../ai/openrouter.js';

// Contrato del servicio

export type AssistantService = (
  question: string
) => Promise<AskResult>;

// Construcción del servicio

export function createAssistantService(
  config: AppConfig
): AssistantService {

  return async (question: string): Promise<AskResult> => {

    if (config.AI_EXECUTION_MODE === 'mock') {

      return generateMockAnswer();

    }

    return generateOpenRouterAnswer(
      question,
      config
    );
  };
}