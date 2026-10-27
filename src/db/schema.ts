import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  primaryKey,
  uniqueIndex,
  index,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  uri: text("uri"),
  isSynthetic: boolean("is_synthetic").notNull().default(false),
  ...timestamps(),
});
const metadata = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  sourceId: uuid("source_id").references(() => sources.id),
  isSynthetic: boolean("is_synthetic").notNull().default(false),
  ...timestamps(),
});
export const organizations = pgTable("organizations", { ...metadata() });
export const functionalGroups = pgTable("functional_groups", { ...metadata() });
export const businessNodes = pgTable(
  "business_nodes",
  {
    ...metadata(),
    parentId: uuid("parent_id").references((): AnyPgColumn => businessNodes.id),
    kind: text("kind").notNull(),
  },
  (t) => [
    check("business_kind", sql`${t.kind} in ('direction','process','stage')`),
    check(
      "business_not_self",
      sql`${t.parentId} is null or ${t.parentId} <> ${t.id}`,
    ),
  ],
);
export const taskClasses = pgTable("task_classes", {
  ...metadata(),
  businessNodeId: uuid("business_node_id").references(() => businessNodes.id),
});
// Separate tables enforce exactly three classification levels, without rating fields.
export const technologyDirections = pgTable("technology_directions", {
  ...metadata(),
});
export const keyTechnologies = pgTable("key_technologies", {
  ...metadata(),
  directionId: uuid("direction_id")
    .notNull()
    .references(() => technologyDirections.id),
});
export const technologyMethods = pgTable("technology_methods", {
  ...metadata(),
  technologyId: uuid("technology_id")
    .notNull()
    .references(() => keyTechnologies.id),
});
export const vendors = pgTable("vendors", {
  ...metadata(),
  country: text("country"),
});
export const vendorSolutions = pgTable("vendor_solutions", {
  ...metadata(),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id),
  specification: text("specification"),
});
export const benchmarkCases = pgTable("benchmark_cases", {
  ...metadata(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  solutionId: uuid("solution_id").references(() => vendorSolutions.id),
  implementationYear: integer("implementation_year"),
});
export const internalProjects = pgTable("internal_projects", {
  ...metadata(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  kind: text("kind").notNull().default("project"),
  status: text("status"),
  proposal: text("proposal"),
});
export const effectTypes = pgTable("effect_types", { ...metadata() });
export const implementationStatus = pgEnum("implementation_status", [
  "yes",
  "no",
  "unknown",
]);
export const scenarios = pgTable(
  "scenarios",
  {
    ...metadata(),
    description: text("description").notNull(),
    externalId: text("external_id").notNull(),
    originNamespace: text("origin_namespace").notNull(),
    rationale: text("rationale"),
    functionalGroupId: uuid("functional_group_id").references(
      () => functionalGroups.id,
    ),
    businessNodeId: uuid("business_node_id").references(() => businessNodes.id),
    businessChallenge: text("business_challenge"),
    implementation: implementationStatus("implementation")
      .notNull()
      .default("unknown"),
    ooda: text("ooda"),
    technologyTrend: text("technology_trend"),
    projectProposal: text("project_proposal"),
  },
  (t) => [
    uniqueIndex("scenario_origin_identity").on(t.originNamespace, t.externalId),
    index("scenario_business_idx").on(t.businessNodeId),
    index("scenario_group_idx").on(t.functionalGroupId),
    index("scenario_status_idx").on(t.implementation),
    check(
      "scenario_ooda",
      sql`${t.ooda} is null or ${t.ooda} in ('observe','orient','decide','act')`,
    ),
  ],
);
export const metricType = pgEnum("metric_type", [
  "market_maturity",
  "organizational_readiness",
  "business_impact",
  "application_trl",
  "solution_potential",
]);
export const assessments = pgTable(
  "scenario_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    metric: metricType("metric").notNull(),
    value: integer("value"),
    qualitativeValue: text("qualitative_value"),
    sourceId: uuid("source_id").references(() => sources.id),
    assessedAt: timestamp("assessed_at", { withTimezone: true }).notNull(),
    organizationalContext: text("organizational_context").notNull(),
    isCurrent: boolean("is_current").notNull().default(true),
    isSynthetic: boolean("is_synthetic").notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("assessment_current_context")
      .on(t.scenarioId, t.metric, t.organizationalContext)
      .where(sql`${t.isCurrent} = true`),
    check(
      "assessment_ranges",
      sql`(${t.metric} = 'market_maturity' and ${t.value} between 1 and 5 and ${t.qualitativeValue} is null) or (${t.metric} = 'organizational_readiness' and ${t.value} between 1 and 7 and ${t.qualitativeValue} is null) or (${t.metric} = 'business_impact' and ${t.value} between 1 and 3 and ${t.qualitativeValue} is null) or (${t.metric} = 'application_trl' and ${t.value} between 1 and 9 and ${t.qualitativeValue} is null) or (${t.metric} = 'solution_potential' and ${t.value} is null and length(trim(${t.qualitativeValue})) > 0)`,
    ),
    check(
      "assessment_has_value",
      sql`(${t.metric} = 'solution_potential' and ${t.qualitativeValue} is not null) or (${t.metric} <> 'solution_potential' and ${t.value} is not null)`,
    ),
  ],
);

const linkMeta = () => ({
  sourceId: uuid("source_id").references(() => sources.id),
  isSynthetic: boolean("is_synthetic").notNull().default(false),
  ...timestamps(),
});
export const scenarioTechnologies = pgTable(
  "scenario_technologies",
  {
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    methodId: uuid("method_id")
      .notNull()
      .references(() => technologyMethods.id),
    ...linkMeta(),
  },
  (t) => [
    primaryKey({ columns: [t.scenarioId, t.methodId] }),
    index("scenario_tech_method_idx").on(t.methodId),
  ],
);
export const scenarioTasks = pgTable(
  "scenario_tasks",
  {
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => taskClasses.id),
    ...linkMeta(),
  },
  (t) => [primaryKey({ columns: [t.scenarioId, t.taskId] })],
);
export const scenarioEffects = pgTable(
  "scenario_effects",
  {
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    effectId: uuid("effect_id")
      .notNull()
      .references(() => effectTypes.id),
    ...linkMeta(),
  },
  (t) => [primaryKey({ columns: [t.scenarioId, t.effectId] })],
);
export const scenarioCases = pgTable(
  "scenario_cases",
  {
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    caseId: uuid("case_id")
      .notNull()
      .references(() => benchmarkCases.id),
    ...linkMeta(),
  },
  (t) => [primaryKey({ columns: [t.scenarioId, t.caseId] })],
);
export const scenarioSolutions = pgTable(
  "scenario_solutions",
  {
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    solutionId: uuid("solution_id")
      .notNull()
      .references(() => vendorSolutions.id),
    ...linkMeta(),
  },
  (t) => [primaryKey({ columns: [t.scenarioId, t.solutionId] })],
);
export const scenarioProjects = pgTable(
  "scenario_projects",
  {
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => internalProjects.id),
    ...linkMeta(),
  },
  (t) => [primaryKey({ columns: [t.scenarioId, t.projectId] })],
);
export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  namespace: text("namespace").notNull(),
  format: text("format").notNull(),
  sourceId: uuid("source_id").references(() => sources.id),
  mapping: text("mapping").notNull(),
  ...timestamps(),
});
export const importRows = pgTable(
  "import_rows",
  {
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id),
    rowNumber: integer("row_number").notNull(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id),
    raw: text("raw").notNull(),
    warnings: text("warnings").notNull(),
  },
  (t) => [primaryKey({ columns: [t.batchId, t.rowNumber] })],
);
