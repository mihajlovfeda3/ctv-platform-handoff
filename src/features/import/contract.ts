import { z } from "zod";
export const importFields = [
  "externalId",
  "name",
  "description",
  "rationale",
  "functionalGroupId",
  "businessNodeId",
  "businessChallenge",
  "businessChallengeDescription",
  "businessEffect",
  "technologyMethodIds",
  "market_maturity",
  "organizational_readiness",
  "business_impact",
  "application_trl",
  "implementation",
  "ooda",
  "technologyTrend",
  "projectProposal",
  "algorithmText",
  "processText",
  "stageText",
  "tasksText",
] as const;
export const importMapping = z
  .object({
    columns: z.partialRecord(z.enum(importFields), z.string().min(1)),
    references: z
      .partialRecord(
        z.enum(["functionalGroupId", "businessNodeId", "technologyMethodIds"]),
        z.record(z.string(), z.uuid()),
      )
      .default({}),
    delimiter: z.enum([",", ";", "\t"]).default(","),
  })
  .superRefine((value, ctx) => {
    for (const key of ["externalId", "name", "description"] as const)
      if (!value.columns[key])
        ctx.addIssue({
          code: "custom",
          message: `Нужно явное сопоставление ${key}`,
          path: ["columns", key],
        });
    const columns = Object.values(value.columns);
    if (new Set(columns).size !== columns.length)
      ctx.addIssue({
        code: "custom",
        message: "Колонка не может назначаться нескольким полям",
        path: ["columns"],
      });
  });
export const importOptions = z.object({
  namespace: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine(
      (s) => !s.startsWith("synthetic-v1-"),
      "Namespace генератора зарезервирован",
    ),
  sourceName: z.string().trim().min(1).max(500),
  synthetic: z.boolean(),
  context: z.string().trim().min(1).max(160),
  assessedAt: z.iso.datetime().optional(),
});
export type ImportMapping = z.infer<typeof importMapping>;
export type ImportOptions = z.infer<typeof importOptions>;
export type Diagnostic = {
  row: number;
  field: string;
  severity: "error" | "warning";
  message: string;
};
