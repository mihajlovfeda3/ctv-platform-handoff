import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { OverviewEnvironment } from "@/components/overview-environment";
import styles from "./overview.module.css";
export const metadata = { title: "Обзор платформы" };
const modules = [
  {
    title: "Сценарии",
    text: "Каталог сценариев, технологический радар, матрица зрелости и карточки сценариев.",
    href: "/scenarios/catalog",
    detail: "Исследовать возможности",
  },
  {
    title: "Бизнес и задачи",
    text: "Бизнес-ландшафт, классы задач и их связи с технологиями.",
    href: "/business",
    detail: "Структура раздела",
  },
  {
    title: "Технологии и рынок",
    text: "Технологический справочник, решения поставщиков и кейсы бенчмаркинга.",
    href: "/technologies",
    detail: "Структура раздела",
  },
  {
    title: "Внутренний портфель",
    text: "Внутренние проекты, продукты, сервисы и их взаимосвязи.",
    href: "/portfolio",
    detail: "Структура раздела",
  },
];
export default function Overview() {
  return (
    <OverviewEnvironment className={styles.overview}>
      <div className={styles.content}>
        <div className={styles.hero}>
          <h1>
            Единое пространство для технологической аналитики и планирования
          </h1>
          <p>
            Исследуйте сценарии, изучайте связи и готовьте основу для следующего
            технологического шага
          </p>
          <Link href="/scenarios/catalog" className={styles.action}>
            Открыть каталог сценариев <ArrowUpRight size={18} />
          </Link>
        </div>
        <nav className={styles.modules} aria-label="Рабочие разделы">
          {modules.map((m, i) => (
            <Link key={m.href} href={m.href} className={styles.card}>
              <div className={styles.cardTop}>
                <span
                  className={styles.accent}
                  data-index={i}
                  aria-hidden="true"
                />
                <ArrowUpRight size={19} aria-hidden="true" />
              </div>
              <h2>{m.title}</h2>
              <p>{m.text}</p>
              <span className={styles.detail}>{m.detail}</span>
            </Link>
          ))}
        </nav>
      </div>
    </OverviewEnvironment>
  );
}
