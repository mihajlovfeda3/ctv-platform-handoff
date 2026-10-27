import { z } from "zod";

export const ratingLimits = {
  market_maturity: 5,
  organizational_readiness: 7,
  business_impact: 3,
  application_trl: 9,
} as const;
export type NumericMetric = keyof typeof ratingLimits;
export const scenarioInput = z.object({
  id: z.uuid().optional(),
  externalId: z.string().trim().min(1).max(160),
  originNamespace: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1).max(20000),
  rationale: z.string().max(20000).nullable().optional(),
  functionalGroupId: z.uuid().nullable().optional(),
  businessNodeId: z.uuid().nullable().optional(),
  businessChallenge: z.string().max(5000).nullable().optional(),
  sourceId: z.uuid().nullable().optional(),
  implementation: z.enum(["yes", "no", "unknown"]).default("unknown"),
  isSynthetic: z.boolean(),
  ooda: z.enum(["observe", "orient", "decide", "act"]).nullable().optional(),
  technologyTrend: z.string().nullable().optional(),
  projectProposal: z.string().nullable().optional(),
});
export type ScenarioInput = z.input<typeof scenarioInput>;
export const assessmentInput = z
  .object({
    metric: z.enum([
      "market_maturity",
      "organizational_readiness",
      "business_impact",
      "application_trl",
    ]),
    value: z.number().int().min(1).max(9),
    sourceId: z.uuid().nullable(),
    assessedAt: z.iso.datetime(),
    organizationalContext: z.string().trim().min(1).max(160),
  })
  .superRefine((v, ctx) => {
    if (v.value > ratingLimits[v.metric])
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `Допустимый диапазон: 1–${ratingLimits[v.metric]}`,
      });
  });
const optionalId = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.uuid().optional(),
);
const optionalScore = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().int().min(1).max(max).optional(),
  );
export const scenarioQuery = z.object({
  q: z.string().trim().max(200).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
  directionId: optionalId,
  businessNodeId: optionalId,
  functionalGroupId: optionalId,
  implementation: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["yes", "no", "unknown"]).optional(),
  ),
  maturity: optionalScore(5),
  readiness: optionalScore(7),
  impact: optionalScore(3),
  context: z.string().trim().min(1).max(160).default("synthetic-lab"),
});
export type ScenarioQuery = z.infer<typeof scenarioQuery>;
export const implementationLabels = {
  yes: "Реализуется",
  no: "Не реализуется",
  unknown: "Неизвестно",
};
export const oodaLabels = {
  observe: "Наблюдение",
  orient: "Ориентация",
  decide: "Принятие решения",
  act: "Действие",
};
