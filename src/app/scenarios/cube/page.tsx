import Link from "next/link";
import { scenarioAnalytics } from "@/server/analytics";
import { getReferences } from "@/server/scenarios";
import { workspaceQuery } from "@/features/scenarios/filter-state";
import { ScenarioFilters } from "@/features/scenarios/filters";
import { originalDirections, demoId } from "@/domain/ctv-reference";
import {
  CubeNavigation,
  IntegratedCube,
} from "@/features/cube/integrated-cube";
import styles from "@/features/cube/cube-integration.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "3D-куб сценариев" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = workspaceQuery(await searchParams);
  if (!parsed)
    return (
      <div className="page surface empty-state">
        <h1>Некорректные параметры фильтра</h1>
        <Link href="/scenarios/cube">Сбросить параметры</Link>
      </div>
    );
  const query = parsed.query;
  const [data, references] = await Promise.all([
    scenarioAnalytics(query),
    getReferences(),
  ]);
  const rows = data.rows.slice(0, 160);
  const selected = data.rows.find((row) => row.id === query.selected);
  if (selected && !rows.includes(selected)) rows.splice(159, 1, selected);
  const directions = originalDirections.map((name, index) => ({
    id: demoId(`direction:${index}`),
    name,
  }));
  return (
    <div className={styles.integration}>
      <CubeNavigation query={query} />
      <details className={styles.filters}>
        <summary>Фильтры сценариев · {data.total}</summary>
        <ScenarioFilters
          query={query}
          references={references}
          view="cube"
          invalidDraft={parsed.invalidDraft}
        />
      </details>
      <div className={styles.scene}>
        <IntegratedCube data={{ ...data, rows, directions }} />
      </div>
    </div>
  );
}
