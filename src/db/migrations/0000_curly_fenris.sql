CREATE TYPE "public"."implementation_status" AS ENUM('yes', 'no', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."metric_type" AS ENUM('market_maturity', 'organizational_readiness', 'business_impact', 'application_trl', 'solution_potential');--> statement-breakpoint
CREATE TABLE "scenario_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"metric" "metric_type" NOT NULL,
	"value" integer,
	"qualitative_value" text,
	"source_id" uuid,
	"assessed_at" timestamp with time zone NOT NULL,
	"organizational_context" text NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_ranges" CHECK (("scenario_assessments"."metric" = 'market_maturity' and "scenario_assessments"."value" between 1 and 5 and "scenario_assessments"."qualitative_value" is null) or ("scenario_assessments"."metric" = 'organizational_readiness' and "scenario_assessments"."value" between 1 and 7 and "scenario_assessments"."qualitative_value" is null) or ("scenario_assessments"."metric" = 'business_impact' and "scenario_assessments"."value" between 1 and 3 and "scenario_assessments"."qualitative_value" is null) or ("scenario_assessments"."metric" = 'application_trl' and "scenario_assessments"."value" between 1 and 9 and "scenario_assessments"."qualitative_value" is null) or ("scenario_assessments"."metric" = 'solution_potential' and "scenario_assessments"."value" is null and length(trim("scenario_assessments"."qualitative_value")) > 0)),
	CONSTRAINT "assessment_has_value" CHECK (("scenario_assessments"."metric" = 'solution_potential' and "scenario_assessments"."qualitative_value" is not null) or ("scenario_assessments"."metric" <> 'solution_potential' and "scenario_assessments"."value" is not null))
);
--> statement-breakpoint
CREATE TABLE "benchmark_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid,
	"solution_id" uuid,
	"implementation_year" integer
);
--> statement-breakpoint
CREATE TABLE "business_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"parent_id" uuid,
	"kind" text NOT NULL,
	CONSTRAINT "business_kind" CHECK ("business_nodes"."kind" in ('direction','process','stage')),
	CONSTRAINT "business_not_self" CHECK ("business_nodes"."parent_id" is null or "business_nodes"."parent_id" <> "business_nodes"."id")
);
--> statement-breakpoint
CREATE TABLE "effect_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "functional_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace" text NOT NULL,
	"format" text NOT NULL,
	"source_id" uuid,
	"mapping" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"scenario_id" uuid NOT NULL,
	"raw" text NOT NULL,
	"warnings" text NOT NULL,
	CONSTRAINT "import_rows_batch_id_row_number_pk" PRIMARY KEY("batch_id","row_number")
);
--> statement-breakpoint
CREATE TABLE "internal_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid,
	"kind" text DEFAULT 'project' NOT NULL,
	"status" text,
	"proposal" text
);
--> statement-breakpoint
CREATE TABLE "key_technologies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"direction_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_cases" (
	"scenario_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenario_cases_scenario_id_case_id_pk" PRIMARY KEY("scenario_id","case_id")
);
--> statement-breakpoint
CREATE TABLE "scenario_effects" (
	"scenario_id" uuid NOT NULL,
	"effect_id" uuid NOT NULL,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenario_effects_scenario_id_effect_id_pk" PRIMARY KEY("scenario_id","effect_id")
);
--> statement-breakpoint
CREATE TABLE "scenario_projects" (
	"scenario_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenario_projects_scenario_id_project_id_pk" PRIMARY KEY("scenario_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "scenario_solutions" (
	"scenario_id" uuid NOT NULL,
	"solution_id" uuid NOT NULL,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenario_solutions_scenario_id_solution_id_pk" PRIMARY KEY("scenario_id","solution_id")
);
--> statement-breakpoint
CREATE TABLE "scenario_tasks" (
	"scenario_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenario_tasks_scenario_id_task_id_pk" PRIMARY KEY("scenario_id","task_id")
);
--> statement-breakpoint
CREATE TABLE "scenario_technologies" (
	"scenario_id" uuid NOT NULL,
	"method_id" uuid NOT NULL,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenario_technologies_scenario_id_method_id_pk" PRIMARY KEY("scenario_id","method_id")
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"external_id" text NOT NULL,
	"origin_namespace" text NOT NULL,
	"rationale" text,
	"functional_group_id" uuid,
	"business_node_id" uuid,
	"business_challenge" text,
	"implementation" "implementation_status" DEFAULT 'unknown' NOT NULL,
	"ooda" text,
	"technology_trend" text,
	"project_proposal" text,
	CONSTRAINT "scenario_ooda" CHECK ("scenarios"."ooda" is null or "scenarios"."ooda" in ('observe','orient','decide','act'))
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"uri" text,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"business_node_id" uuid
);
--> statement-breakpoint
CREATE TABLE "technology_directions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technology_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"technology_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_solutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"specification" text
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_id" uuid,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"country" text
);
--> statement-breakpoint
ALTER TABLE "scenario_assessments" ADD CONSTRAINT "scenario_assessments_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_assessments" ADD CONSTRAINT "scenario_assessments_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark_cases" ADD CONSTRAINT "benchmark_cases_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark_cases" ADD CONSTRAINT "benchmark_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark_cases" ADD CONSTRAINT "benchmark_cases_solution_id_vendor_solutions_id_fk" FOREIGN KEY ("solution_id") REFERENCES "public"."vendor_solutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_nodes" ADD CONSTRAINT "business_nodes_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_nodes" ADD CONSTRAINT "business_nodes_parent_id_business_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."business_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "effect_types" ADD CONSTRAINT "effect_types_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functional_groups" ADD CONSTRAINT "functional_groups_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_projects" ADD CONSTRAINT "internal_projects_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_projects" ADD CONSTRAINT "internal_projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_technologies" ADD CONSTRAINT "key_technologies_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_technologies" ADD CONSTRAINT "key_technologies_direction_id_technology_directions_id_fk" FOREIGN KEY ("direction_id") REFERENCES "public"."technology_directions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_cases" ADD CONSTRAINT "scenario_cases_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_cases" ADD CONSTRAINT "scenario_cases_case_id_benchmark_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."benchmark_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_cases" ADD CONSTRAINT "scenario_cases_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_effects" ADD CONSTRAINT "scenario_effects_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_effects" ADD CONSTRAINT "scenario_effects_effect_id_effect_types_id_fk" FOREIGN KEY ("effect_id") REFERENCES "public"."effect_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_effects" ADD CONSTRAINT "scenario_effects_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_projects" ADD CONSTRAINT "scenario_projects_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_projects" ADD CONSTRAINT "scenario_projects_project_id_internal_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."internal_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_projects" ADD CONSTRAINT "scenario_projects_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_solutions" ADD CONSTRAINT "scenario_solutions_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_solutions" ADD CONSTRAINT "scenario_solutions_solution_id_vendor_solutions_id_fk" FOREIGN KEY ("solution_id") REFERENCES "public"."vendor_solutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_solutions" ADD CONSTRAINT "scenario_solutions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_tasks" ADD CONSTRAINT "scenario_tasks_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_tasks" ADD CONSTRAINT "scenario_tasks_task_id_task_classes_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_tasks" ADD CONSTRAINT "scenario_tasks_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_technologies" ADD CONSTRAINT "scenario_technologies_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_technologies" ADD CONSTRAINT "scenario_technologies_method_id_technology_methods_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."technology_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_technologies" ADD CONSTRAINT "scenario_technologies_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_functional_group_id_functional_groups_id_fk" FOREIGN KEY ("functional_group_id") REFERENCES "public"."functional_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_business_node_id_business_nodes_id_fk" FOREIGN KEY ("business_node_id") REFERENCES "public"."business_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_classes" ADD CONSTRAINT "task_classes_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_classes" ADD CONSTRAINT "task_classes_business_node_id_business_nodes_id_fk" FOREIGN KEY ("business_node_id") REFERENCES "public"."business_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_directions" ADD CONSTRAINT "technology_directions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_methods" ADD CONSTRAINT "technology_methods_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_methods" ADD CONSTRAINT "technology_methods_technology_id_key_technologies_id_fk" FOREIGN KEY ("technology_id") REFERENCES "public"."key_technologies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_solutions" ADD CONSTRAINT "vendor_solutions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_solutions" ADD CONSTRAINT "vendor_solutions_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_current_context" ON "scenario_assessments" USING btree ("scenario_id","metric","organizational_context") WHERE "scenario_assessments"."is_current" = true;--> statement-breakpoint
CREATE INDEX "scenario_tech_method_idx" ON "scenario_technologies" USING btree ("method_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_origin_identity" ON "scenarios" USING btree ("origin_namespace","external_id");--> statement-breakpoint
CREATE INDEX "scenario_business_idx" ON "scenarios" USING btree ("business_node_id");--> statement-breakpoint
CREATE INDEX "scenario_group_idx" ON "scenarios" USING btree ("functional_group_id");--> statement-breakpoint
CREATE INDEX "scenario_status_idx" ON "scenarios" USING btree ("implementation");