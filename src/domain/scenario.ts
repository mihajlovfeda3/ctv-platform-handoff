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
  businessChallengeDescription: z.string().max(20000).nullable().optional(),
  businessEffect: z.string().max(20000).nullable().optional(),
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
export const scenarioQuery = z
  .object({
    selected: optionalId,
    cluster: z.string().max(120).optional(),
    cell: z
      .string()
      .regex(/^(unknown|[1-5]:[1-7])$/)
      .optional(),
    zoom: z.coerce.number().min(1).max(8).default(1),
    panX: z.coerce.number().min(-10000).max(10000).default(0),
    panY: z.coerce.number().min(-10000).max(10000).default(0),
    mode: z.enum(["groups", "points"]).default("groups"),
    from: z.enum(["catalog", "radar", "maturity"]).default("catalog"),
    sort: z
      .enum(["id", "name", "maturity", "readiness", "impact"])
      .default("id"),
    order: z.enum(["asc", "desc"]).default("asc"),
    maturityMin: optionalScore(5),
    maturityMax: optionalScore(5),
    readinessMin: optionalScore(7),
    readinessMax: optionalScore(7),
    impactMin: optionalScore(3),
    impactMax: optionalScore(3),
    q: z.string().trim().max(200).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
    blockId: optionalId,
    businessDirectionId: optionalId,
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
  })
  .superRefine((v, ctx) => {
    for (const prefix of ["maturity", "readiness", "impact"] as const) {
      const min = v[`${prefix}Min`],
        max = v[`${prefix}Max`];
      if (min !== undefined && max !== undefined && min > max)
        ctx.addIssue({
          code: "custom",
          path: [`${prefix}Max`],
          message: "Верхняя граница меньше нижней",
        });
    }
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
