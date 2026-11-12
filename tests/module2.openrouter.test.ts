import {
  describe,
  it,
  expect,
  vi,
} from "vitest";

import {
  OpenRouterStructuredClient,
} from "../src/ai/openrouter-structured.js";

const modelId = "test/model:free";

const activity = {
  title: "Actividad académica",
  summary: "Implementar una API con Express",
  topics: ["Express"],
  difficulty: "media",
  estimatedHours: 3,
  deadline: null,
};

const messages = [
  {
    role: "system" as const,
    content: "Extrae información estructurada",
  },
  {
    role: "user" as const,
    content: "Crear una API REST con Express.",
  },
];

const catalog = {
  data: [
    {
      id: modelId,

      pricing: {
        prompt: "0",
        completion: "0",
      },

      supported_parameters: [
        "structured_outputs",
        "response_format",
      ],

      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    },
  ],
};

function createFakeFetch() {
  return vi.fn(
    async (
      url: string | URL,
      _init?: RequestInit
    ): Promise<Response> => {

      const path = String(url);

      if (path.endsWith("/models")) {
        return new Response(
          JSON.stringify(catalog),
          { status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: JSON.stringify(activity),
              },
            },
          ],

          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        }),
        { status: 200 }
      );
    }
  );
}

describe("Módulo II - OpenRouter Structured", () => {

  it("envía json_schema en modo structured", async () => {
    const fakeFetch = createFakeFetch();

    const client = new OpenRouterStructuredClient({
      apiKey: "test-api-key",
      fetcher: fakeFetch,
    });

    await client.generate({
      model: modelId,
      mode: "structured",
      messages,
    });

    expect(fakeFetch).toHaveBeenCalledTimes(2);

    const postCall = fakeFetch.mock.calls[1];

    const options = postCall[1];

    const body = JSON.parse(
      String(options?.body)
    );

    expect(body.response_format.type).toBe(
      "json_schema"
    );

    expect(body.response_format.json_schema.strict)
      .toBe(true);

    expect(body.provider.require_parameters)
      .toBe(true);
  });

  it("envía json_object en JSON Mode", async () => {
    const fakeFetch = createFakeFetch();

    const client = new OpenRouterStructuredClient({
      apiKey: "test-api-key",
      fetcher: fakeFetch,
    });

    await client.generate({
      model: modelId,
      mode: "json_mode",
      messages,
    });

    const options = fakeFetch.mock.calls[1][1];

    const body = JSON.parse(
      String(options?.body)
    );

    expect(body.response_format.type).toBe(
      "json_object"
    );
  });

  it("rechaza modelos que no sean :free", async () => {
    const fakeFetch = createFakeFetch();

    const client = new OpenRouterStructuredClient({
      apiKey: "test-api-key",
      fetcher: fakeFetch,
    });

    await expect(
      client.generate({
        model: "vendor/model-pago",
        mode: "structured",
        messages,
      })
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "FREE_ONLY",
    });

    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("rechaza modelos incompatibles", async () => {
    const incompatibleCatalog = {
      data: [
        {
          ...catalog.data[0],
          supported_parameters: [],
        },
      ],
    };

    const fakeFetch = vi.fn(
      async (): Promise<Response> =>
        new Response(
          JSON.stringify(incompatibleCatalog),
          { status: 200 }
        )
    );

    const client = new OpenRouterStructuredClient({
      apiKey: "test-api-key",
      fetcher: fakeFetch,
    });

    await expect(
      client.generate({
        model: modelId,
        mode: "structured",
        messages,
      })
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "STRUCTURED_OUTPUT_UNSUPPORTED",
    });

    expect(fakeFetch).toHaveBeenCalledOnce();
  });

  it("devuelve métricas de uso", async () => {
    const client = new OpenRouterStructuredClient({
      apiKey: "test-api-key",
      fetcher: createFakeFetch(),
    });

    const result = await client.generate({
      model: modelId,
      mode: "structured",
      messages,
    });

    expect(result.usage).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
  });
});