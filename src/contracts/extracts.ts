import { z } from "zod";

// Modos de generación disponibles.
export const extractionModeSchema = z.enum([
  "json_mode",
  "structured",
]);

// Contrato de entrada HTTP.
export const extractRequestSchema = z.object({
  text: z.string()
    .trim()
    .min(20, "El texto debe tener al menos 20 caracteres")
    .max(2500, "El texto supera el máximo permitido"),

  mode: extractionModeSchema.default("structured"),

  model: z.string()
    .min(3)
    .max(120)
    .regex(
      /^[\w.-]+\/[\w.:-]+$/,
      "Identificador de modelo inválido"
    )
    .optional(),
}).strict();

// Verifica que una fecha sea real y use YYYY-MM-DD.
function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// Contrato de salida generado por el LLM.
export const extractedActivitySchema = z.object({
  title: z.string().trim().min(1).max(160),

  summary: z.string().trim().min(1).max(450),

  topics: z.array(
    z.string().trim().min(1).max(80)
  ).max(12),

  difficulty: z.enum([
    "baja",
    "media",
    "alta",
    "no_especificada",
  ]),

  estimatedHours: z.number()
    .finite()
    .positive()
    .max(1000)
    .nullable(),

  deadline: z.string()
    .refine(isValidDate, "Fecha inválida")
    .nullable(),
}).strict();

// Tipos inferidos desde Zod.
export type ExtractionMode =
  z.infer<typeof extractionModeSchema>;

export type ExtractRequest =
  z.infer<typeof extractRequestSchema>;

export type ExtractedActivity =
  z.infer<typeof extractedActivitySchema>;

// JSON Schema enviado al proveedor.
// Los campos son obligatorios.
// La ausencia de datos se expresa mediante null.
export const activityJsonSchema = {
  type: "object",

  properties: {
    title: {
      type: "string",
      description: "Título breve de la actividad",
    },

    summary: {
      type: "string",
      description: "Descripción breve de la actividad",
    },

    topics: {
      type: "array",
      items: {
        type: "string",
      },
      description: "Temas mencionados en el texto",
    },

    difficulty: {
      type: "string",
      enum: [
        "baja",
        "media",
        "alta",
        "no_especificada",
      ],
    },

    estimatedHours: {
      type: ["number", "null"],
      description: "Horas explícitas o null si no existen",
    },

    deadline: {
      type: ["string", "null"],
      description: "Fecha YYYY-MM-DD o null",
    },
  },

  required: [
    "title",
    "summary",
    "topics",
    "difficulty",
    "estimatedHours",
    "deadline",
  ],

  additionalProperties: false,
} as const;

// Metadatos de uso del proveedor.
export interface ExtractUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

// Contrato HTTP de respuesta.
export interface ExtractResponse {
  model: string;
  mode: ExtractionMode;
  data: ExtractedActivity;
  usage: ExtractUsage | null;
}