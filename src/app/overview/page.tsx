import Link from "next/link";
import { ArrowUpRight, Workflow, Cpu, Layers3 } from "lucide-react";
import { OverviewEnvironment } from "@/components/overview-environment";
import { ScenariosIcon } from "@/components/scenarios-icon";
import styles from "./overview.module.css";
export const metadata = { title: "Обзор платформы" };
const modules = [
  {
    title: "Сценарии",
    text: "Каталог сценариев, технологический радар, матрица зрелости и карточки сценариев.",
    href: "/scenarios/catalog",
    icon: ScenariosIcon,
  },
  {
    title: "Бизнес и задачи",
    text: "Бизнес-ландшафт, классы задач и их связи с технологиями.",
    href: "/business",
    icon: Workflow,
  },
  {
    title: "Технологии и рынок",
    text: "Технологический справочник, решения поставщиков и кейсы бенчмаркинга.",
    href: "/technologies",
    icon: Cpu,
  },
  {
    title: "Внутренний портфель",
    text: "Внутренние проекты, продукты, сервисы и их взаимосвязи.",
    href: "/portfolio",
    icon: Layers3,
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
          {modules.map((m) => (
            <Link key={m.href} href={m.href} className={styles.card}>
              <div className={styles.cardTop}>
                <m.icon size={26} strokeWidth={1.4} aria-hidden="true" />
                <ArrowUpRight size={19} aria-hidden="true" />
              </div>
              <h2>{m.title}</h2>
              <p>{m.text}</p>
            </Link>
          ))}
        </nav>
      </div>
    </OverviewEnvironment>
  );
}
