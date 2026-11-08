"use client";
import Link from "next/link";
import cubeStyles from "@/features/cube/cube-integration.module.css";
import { ScenariosIcon } from "./scenarios-icon";
import { NavigationGroup } from "./navigation-group";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useEffect, useRef } from "react";
import { workspaceQuery } from "@/features/scenarios/filter-state";
import { scenarioQuery } from "@/domain/scenario";
import {
  workspaceHref,
  views,
  type ScenarioView,
} from "@/features/scenarios/navigation";
import {
  LayoutDashboard,
  Workflow,
  Cpu,
  Layers3,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
const navigation = [
  { href: "/overview", label: "Обзор", icon: LayoutDashboard },
  { href: "/scenarios", label: "Сценарии", icon: ScenariosIcon },
  { href: "/business", label: "Бизнес и задачи", icon: Workflow },
  { href: "/technologies", label: "Технологии и рынок", icon: Cpu },
  { href: "/portfolio", label: "Внутренний портфель", icon: Layers3 },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        !/^\/scenarios\/(radar|maturity|catalog)$/.test(
          window.location.pathname,
        )
      )
        return;
      // The native popover closes on Escape even before focus moves into it.
      if (document.querySelector(".radar-info-popover:popover-open")) return;
      const url = new URL(window.location.href);
      if (url.searchParams.has("selected")) url.searchParams.delete("selected");
      else if (
        url.searchParams.has("cluster") ||
        url.searchParams.has("cell")
      ) {
        url.searchParams.delete("cluster");
        url.searchParams.delete("cell");
      } else return;
      router.replace(url.pathname + url.search, { scroll: false });
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [router]);
  const [collapsed, setCollapsed] = useState(false),
    [peek, setPeek] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        setCollapsed(localStorage.getItem("ctv-nav-collapsed") === "true");
      } catch {}
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const toggle = () => {
    clearTimer();
    const next = peek ? false : !collapsed;
    setCollapsed(next);
    setPeek(false);
    try {
      localStorage.setItem("ctv-nav-collapsed", String(next));
    } catch {}
  };
  const open = () => {
    clearTimer();
    if (collapsed) timer.current = setTimeout(() => setPeek(true), 180);
  };
  const close = () => {
    clearTimer();
    timer.current = setTimeout(() => {
      if (!(
        document.activeElement?.matches(":focus-visible") &&
        document.activeElement?.closest(".sidebar")
      ))
        setPeek(false);
    }, 260);
  };

  const active = navigation.find((item) => pathname.startsWith(item.href));
  return (
    <div
      className={`app-shell ${collapsed ? "nav-collapsed" : ""} ${peek && collapsed ? "nav-peek" : ""} ${pathname === "/overview" ? "overview-shell" : ""} ${pathname === "/scenarios/catalog" ? "catalog-shell" : pathname === "/scenarios/radar" ? "radar-shell" : pathname === "/scenarios/maturity" ? "matrix-shell" : ""}`}
    >
      <div
        onPointerLeave={close}
        onFocusCapture={(event) => {
          clearTimer();
          if (
            collapsed &&
            (event.target as HTMLElement).matches(":focus-visible")
          )
            setPeek(true);
        }}
        onBlurCapture={close}
      >
        {collapsed && (
          <div
            className="nav-edge"
            data-testid="nav-edge"
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") open();
            }}
            aria-hidden="true"
          />
        )}
        <Suspense fallback={<aside className="sidebar" />}>
          <Sidebar
            collapsed={collapsed && !peek}
            preview={collapsed && peek}
            onToggle={toggle}
            onEnter={() => {
              if (peek) clearTimer();
            }}
          />
        </Suspense>
      </div>
      <div className="main-shell">
        {pathname !== "/overview" && (
          <header
            className={`topbar ${pathname === "/scenarios/cube" ? cubeStyles.topbar : ""}`}
          >
            <div className="breadcrumb">
              Рабочее пространство <span>/</span>{" "}
              <strong>{active?.label ?? "Сценарии"}</strong>
              {pathname === "/scenarios/cube" && (
                <>
                  <span>/</span>
                  <strong>3D-куб</strong>
                </>
              )}
            </div>
          </header>
        )}
        <main id="main-content">{children}</main>
        <footer className="footer">
          <span>
            ЦТВ Platform <span className="footer-sep">/</span> Пространство
            технологических возможностей
          </span>
        </footer>
      </div>
    </div>
  );
}

function Sidebar({
  collapsed,
  onToggle,
  preview,
  onEnter,
}: {
  collapsed: boolean;
  onToggle: () => void;
  preview: boolean;
  onEnter: () => void;
}) {
  const pathname = usePathname(),
    params = useSearchParams();
  const result = workspaceQuery(Object.fromEntries(params));
  const query = result?.query ?? scenarioQuery.parse({});
  const activeView =
    pathname === "/scenarios/catalog"
      ? "catalog"
      : pathname === "/scenarios/maturity"
        ? "maturity"
        : pathname === "/scenarios/radar" || pathname === "/scenarios"
          ? "radar"
          : pathname === "/scenarios/cube"
            ? "cube"
            : pathname.startsWith("/scenarios/")
              ? query.from
              : null;
  return (
    <aside
      className="sidebar"
      aria-label="Боковая панель"
      onPointerEnter={onEnter}
    >
      <button
        className="sidebar-toggle"
        aria-label={
          preview
            ? "Закрепить панель"
            : collapsed
              ? "Развернуть панель"
              : "Свернуть панель"
        }
        aria-expanded={!collapsed}
        onClick={onToggle}
        title={
          preview
            ? "Закрепить панель"
            : collapsed
              ? "Развернуть панель"
              : "Свернуть панель"
        }
      >
        {collapsed || preview ? (
          <ChevronRight size={17} />
        ) : (
          <ChevronLeft size={17} />
        )}
      </button>
      <Link href="/overview" className="brand" aria-label="ЦТВ — на обзор">
        <span className="brand-full">
          Цифровое
          <br />
          технологическое
          <br />
          видение
        </span>
        <span className="brand-compact">ЦТВ</span>
      </Link>
      <nav aria-label="Основная навигация">
        {navigation.map(({ href, label, icon }) => (
          <NavigationGroup
            key={href}
            href={href === "/scenarios" ? workspaceHref("radar", query) : href}
            label={label}
            icon={icon}
            active={pathname.startsWith(href)}
            compact={collapsed}
            id={href === "/scenarios" ? "scenario-subnav" : undefined}
            items={
              href === "/scenarios"
                ? (["catalog", "radar", "maturity", "cube"] as const).map(
                    (key) => ({
                      href: workspaceHref(key as ScenarioView, query),
                      label: views[key],
                      active: activeView === key,
                    }),
                  )
                : undefined
            }
          />
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span
          className="help-link platform-help"
          role="link"
          aria-disabled="true"
          tabIndex={0}
          aria-label="О платформе — информационная страница пока недоступна"
          title="О платформе — информационная страница пока недоступна"
        >
          <CircleHelp size={19} aria-hidden="true" />
          <span>О платформе</span>
        </span>
      </div>
    </aside>
  );
}
