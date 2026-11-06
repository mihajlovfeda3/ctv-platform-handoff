"use client";
import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Analytics } from "@/domain/analytics";
import type { WorkspaceQuery } from "@/features/scenarios/filter-state";
import { workspaceQuery } from "@/features/scenarios/filter-state";
import {
  views,
  workspaceHref,
  type ScenarioView,
} from "@/features/scenarios/navigation";
import { CubePrototype } from "./cube-prototype";
import styles from "./cube-integration.module.css";

export function CubeNavigation({ query }: { query: WorkspaceQuery }) {
  const params = useSearchParams();
  const live = workspaceQuery(Object.fromEntries(params))?.query ?? query;
  return (
    <nav
      className={`scenario-tabs ${styles.tabs}`}
      aria-label="Представления сценариев"
    >
      {Object.entries(views).map(([view, title]) => (
        <Link
          key={view}
          href={workspaceHref(view as ScenarioView, live)}
          scroll={false}
          aria-current={view === "cube" ? "page" : undefined}
        >
          {title}
        </Link>
      ))}
    </nav>
  );
}

export function IntegratedCube({ data }: { data: Analytics }) {
  const params = useSearchParams();
  const selected =
    workspaceQuery(Object.fromEntries(params))?.query.selected ?? null;
  const select = useCallback((id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("selected", id);
    else url.searchParams.delete("selected");
    // Native History integrates with useSearchParams without reloading the 3D scene.
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);
  return (
    <>
      <CubePrototype
        data={data}
        selectedFromUrl={selected}
        onSelectionChange={select}
      />
      {selected && !data.rows.some((row) => row.id === selected) && (
        <p className={styles.notice}>
          Выбор сохранён в URL; сценарий не входит в текущую выборку.
        </p>
      )}
    </>
  );
}
