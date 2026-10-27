"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const active = navigation.find((item) => pathname.startsWith(item.href));
  return (
    <div className="app-shell">
      <aside className="sidebar">
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
            <Link
              key={href}
              href={href}
              className={`nav-item ${pathname.startsWith(href) ? "active" : ""}`}
              aria-current={pathname.startsWith(href) ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
              {pathname.startsWith(href) && <span className="active-dot" />}
            </Link>
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
            ТЕХНИЧЕСКИЙ ФУНДАМЕНТ <span>v0.1</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Рабочее пространство <span>/</span>{" "}
            <strong>{active?.label ?? "Сценарии"}</strong>
          </div>
          <div className="topbar-right">
            <span className="iteration">
              <span className="live-dot" /> Итерация 01
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
