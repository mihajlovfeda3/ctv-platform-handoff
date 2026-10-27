import { Suspense } from "react";
import Link from "next/link";
import { ArrowDownRight, Layers3 } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { RadarWorkspace } from "@/components/radar-workspace";
import { ScenarioFilters } from "@/features/scenarios/filters";
import { ScenarioCatalog } from "@/features/scenarios/catalog";
import { listScenarios, getReferences } from "@/server/scenarios";
import { scenarioQuery } from "@/domain/scenario";
import { scenarioNoun } from "@/lib/format";
export const dynamic = "force-dynamic";
export const metadata = { title: "Сценарии применения" };
async function Content({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = scenarioQuery.safeParse(await searchParams);
  if (!parsed.success)
    return (
      <div className="surface empty-state">
        <h2>Некорректные параметры фильтра</h2>
        <p>
          Уровни оценок и идентификаторы должны соответствовать справочникам.
        </p>
        <Link href="/scenarios" className="button">
          Сбросить параметры
        </Link>
      </div>
    );
  const [result, references] = await Promise.all([
    listScenarios(parsed.data),
    getReferences(),
  ]);
  return (
    <>
      <ScenarioFilters query={parsed.data} references={references} />
      <div className="workspace-summary">
        <span>
          <Layers3 size={16} />
          <strong>{result.total}</strong> {scenarioNoun(result.total)} в выборке
        </span>
        <span>
          Единый каталог технологических возможностей{" "}
          <ArrowDownRight size={15} />
        </span>
      </div>
      <ScenarioCatalog result={result} query={parsed.data} />
      <RadarWorkspace />
    </>
  );
}
export default function Scenarios(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="page">
      <PageHeading
        eyebrow="ИССЛЕДУЙТЕ ВОЗМОЖНОСТИ"
        title="Сценарии применения ЦТ"
        description="От бизнес-задачи — к технологии, решению и ожидаемому эффекту."
        action={
          <span className="tag demo-tag">
            <span className="live-dot" /> Синтетическая среда
          </span>
        }
      />
      <Suspense
        fallback={
          <div className="surface loading-state" role="status">
            Загружаем каталог из PostgreSQL…
          </div>
        }
      >
        <Content {...props} />
      </Suspense>
    </div>
  );
}
