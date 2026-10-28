"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { workspaceQuery } from "@/features/scenarios/filter-state";
import { scenarioQuery } from "@/domain/scenario";
import {
  workspaceHref,
  views,
  type ScenarioView,
} from "@/features/scenarios/navigation";
import {
  LayoutDashboard,
  ScanLine,
  Workflow,
  Cpu,
  Layers3,
  ArrowUpRight,
  CircleHelp,
  FlaskConical,
} from "lucide-react";
const navigation = [
  { href: "/overview", label: "Обзор", icon: LayoutDashboard },
  { href: "/scenarios", label: "Сценарии", icon: ScanLine },
  { href: "/business", label: "Бизнес и задачи", icon: Workflow },
  { href: "/technologies", label: "Технологии и рынок", icon: Cpu },
  { href: "/portfolio", label: "Внутренний портфель", icon: Layers3 },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const active = navigation.find((item) => pathname.startsWith(item.href));
  return (
    <div className={`app-shell ${collapsed ? "nav-collapsed" : ""}`}>
      <Suspense fallback={<aside className="sidebar" />}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
      </Suspense>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Рабочее пространство <span>/</span>{" "}
            <strong>{active?.label ?? "Сценарии"}</strong>
          </div>
          <div className="topbar-right">
            <span className="iteration">
              <span className="live-dot" /> Синтетическая среда
            </span>
            <span
              className="avatar"
              title="Локальная среда, авторизация не подключена"
            >
              ЦТ
            </span>
          </div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="footer">
          <span>
            ЦТВ Platform <span className="footer-sep">/</span> Пространство
            технологических возможностей
          </span>
          <span>Все тестовые сведения вымышлены</span>
        </footer>
      </div>
    </div>
  );
}

function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname(),
    params = useSearchParams(),
    [expanded, setExpanded] = useState(true);
  const result = workspaceQuery(Object.fromEntries(params));
  const query = result?.query ?? scenarioQuery.parse({});
  const activeView =
    pathname === "/scenarios/catalog"
      ? "catalog"
      : pathname === "/scenarios/maturity"
        ? "maturity"
        : pathname === "/scenarios/radar" || pathname === "/scenarios"
          ? "radar"
          : pathname.startsWith("/scenarios/")
            ? query.from
            : null;
  return (
    <aside className="sidebar" aria-label="Боковая панель">
      <button
        className="sidebar-toggle"
        aria-label={collapsed ? "Развернуть панель" : "Свернуть панель"}
        aria-expanded={!collapsed}
        onClick={onToggle}
        title={collapsed ? "Развернуть панель" : "Свернуть панель"}
      >
        {collapsed ? "»" : "«"}
      </button>
      <Link href="/overview" className="brand" aria-label="ЦТВ — на обзор">
        <span className="brand-symbol">
          ц<span>т</span>в<span className="brand-dot" />
        </span>
        <span className="brand-caption">
          ЦИФРОВОЕ
          <br />
          ТЕХНОЛОГИЧЕСКОЕ ВИДЕНИЕ
        </span>
      </Link>
      <div className="workspace-label">
        ПЛАТФОРМА ЦТВ <span>01</span>
      </div>
      <nav aria-label="Основная навигация">
        {navigation.map(({ href, label, icon: Icon }) => (
          <div key={href} className="nav-row">
            <Link
              href={
                href === "/scenarios" ? workspaceHref("radar", query) : href
              }
              scroll={false}
              className={`nav-item ${pathname.startsWith(href) ? "active" : ""}`}
              aria-label={label}
              title={collapsed ? label : undefined}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon size={19} />
              <span className="nav-label-text">{label}</span>
            </Link>
            {href === "/scenarios" && (
              <button
                className="submenu-toggle"
                title={expanded ? "Скрыть подразделы" : "Показать подразделы"}
                aria-label={
                  expanded
                    ? "Скрыть подразделы сценариев"
                    : "Показать подразделы сценариев"
                }
                aria-expanded={expanded}
                aria-controls="scenario-subnav"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "⌃" : "⌄"}
              </button>
            )}
            {href === "/scenarios" && (
              <>
                {" "}
                <div
                  id="scenario-subnav"
                  hidden={!expanded}
                  className="scenario-subnav"
                >
                  {Object.entries(views).map(([key, label]) => (
                    <Link
                      key={key}
                      href={workspaceHref(key as ScenarioView, query)}
                      scroll={false}
                      aria-current={activeView === key ? "page" : undefined}
                      aria-label={label}
                      title={collapsed ? label : undefined}
                    >
                      <span aria-hidden="true">
                        {key === "radar" ? "◎" : key === "catalog" ? "≡" : "▦"}
                      </span>
                      <span className="nav-label-text">{label}</span>
                    </Link>
                  ))}
                </div>{" "}
              </>
            )}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="environment">
          <FlaskConical size={17} />
          <div>
            <strong>Среда разработки</strong>
            <span>Синтетические данные</span>
          </div>
          <span className="live-dot" />
        </div>
        <Link href="/overview#foundation" className="help-link">
          <CircleHelp size={17} /> О платформе <ArrowUpRight size={14} />
        </Link>
        <div className="sidebar-version">
          ПЛАТФОРМА ЦТВ <span>v0.1</span>
        </div>
      </div>
    </aside>
  );
}
