import Link from "next/link";
import { ArrowRight, Blocks } from "lucide-react";
import { PageHeading } from "./page-heading";
export function SectionPlaceholder({
  eyebrow,
  title,
  description,
  layers,
}: {
  eyebrow: string;
  title: string;
  description: string;
  layers: string[];
}) {
  return (
    <div className="page">
      <PageHeading eyebrow={eyebrow} title={title} description={description} />
      <section className="surface placeholder">
        <span className="placeholder-icon">
          <Blocks size={29} />
        </span>
        <span className="tag neutral">Структура подготовлена</span>
        <h2>Модуль будет развиваться поэтапно</h2>
        <p>
          В первой итерации создана модель данных и связи со сценариями.
          Самостоятельные каталоги и аналитические представления этого раздела
          ещё не реализованы.
        </p>
        <div className="layer-pills">
          {layers.map((layer) => (
            <span key={layer}>{layer}</span>
          ))}
        </div>
        <Link className="button primary" href="/scenarios">
          Перейти к сценариям <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  );
}
