import Link from "next/link";
import {
  ArrowUpRight,
  ScanLine,
  Workflow,
  Cpu,
  Layers3,
  Database,
  GitBranch,
  FileInput,
  ShieldCheck,
} from "lucide-react";
import { PageHeading } from "@/components/page-heading";
export const metadata = { title: "Обзор платформы" };
const modules = [
  {
    title: "Сценарии",
    text: "Каталог способов применения цифровых технологий. Поиск, фильтры и связанные объекты.",
    href: "/scenarios",
    icon: ScanLine,
    status: "Доступно",
    number: "01",
  },
  {
    title: "Бизнес и задачи",
    text: "Иерархия бизнес-процессов и классы задач, которые можно решать с помощью технологий.",
    href: "/business",
    icon: Workflow,
    status: "Структура подготовлена",
    number: "02",
  },
  {
    title: "Технологии и рынок",
    text: "Технологический справочник, кейсы бенчмаркинга и решения поставщиков.",
    href: "/technologies",
    icon: Cpu,
    status: "Структура подготовлена",
    number: "03",
  },
  {
    title: "Внутренний портфель",
    text: "Внутренние проекты, продукты и сервисы в связи со сценариями применения.",
    href: "/portfolio",
    icon: Layers3,
    status: "Структура подготовлена",
    number: "04",
  },
];
export default function Overview() {
  return (
    <div className="page">
      <PageHeading
        eyebrow="ЦИФРОВОЕ ТЕХНОЛОГИЧЕСКОЕ ВИДЕНИЕ"
        title="От возможностей — к решениям"
        description="Единое пространство для технологической аналитики и планирования."
        action={
          <span className="tag demo-tag">
            Итерация 01 · Технический фундамент
          </span>
        }
      />
      <section className="overview-hero">
        <div className="hero-text">
          <span className="eyebrow">ПЛАТФОРМА ЦТВ</span>
          <h2>
            Связываем бизнес-задачи
            <br />с цифровыми технологиями
          </h2>
          <p>
            Исследуйте сценарии, изучайте связи и готовьте основу для следующего
            технологического шага.
          </p>
          <Link href="/scenarios/catalog" className="button hero-button">
            Открыть каталог сценариев <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="hero-orbits" aria-hidden="true">
          <div />
          <div />
          <div />
          <span className="orbit-center">ЦТВ</span>
          <i className="orbit-node n1" />
          <i className="orbit-node n2" />
          <i className="orbit-node n3" />
          <i className="orbit-node n4" />
        </div>
      </section>
      <div className="section-intro">
        <h2>Рабочие разделы</h2>
        <span>Пять разделов · восемь предметных слоёв</span>
      </div>
      <div className="module-grid">
        {modules.map(({ title, text, href, icon: Icon, status, number }) => (
          <Link href={href} className="surface module-card" key={href}>
            <div className="module-top">
              <span className="module-icon">
                <Icon size={22} />
              </span>
              <span>{number}</span>
            </div>
            <h3>
              {title}
              <ArrowUpRight size={18} />
            </h3>
            <p>{text}</p>
            <span
              className={`module-status ${href === "/scenarios" ? "ready" : ""}`}
            >
              <i />
              {status}
            </span>
          </Link>
        ))}
      </div>
      <section className="surface foundation" id="foundation">
        <div>
          <div className="eyebrow">ОСНОВА ДЛЯ РАЗВИТИЯ</div>
          <h2>Первая итерация платформы</h2>
          <p>
            Доступен минимальный сценарный контур. Аналитические представления
            будут добавляться поэтапно.
          </p>
        </div>
        <div className="foundation-grid">
          {[
            [
              Database,
              "Реляционная модель",
              "Восемь связанных предметных слоёв",
            ],
            [
              GitBranch,
              "Независимые оценки",
              "Источник, дата и контекст организации",
            ],
            [
              FileInput,
              "Структурированный импорт",
              "CSV и JSON с проверкой значений",
            ],
            [
              ShieldCheck,
              "Синтетическая среда",
              "Вымышленные записи для разработки",
            ],
          ].map(([Icon, title, text]) => {
            const I = Icon as typeof Database;
            return (
              <div key={String(title)}>
                <I size={19} />
                <strong>{String(title)}</strong>
                <span>{String(text)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
