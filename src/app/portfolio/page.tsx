import { SectionPlaceholder } from "@/components/section-placeholder";
export const metadata = { title: "Внутренний портфель" };
export default function Portfolio() {
  return (
    <SectionPlaceholder
      eyebrow="ВНУТРЕННЯЯ ЭКОСИСТЕМА"
      title="Внутренний портфель"
      description="Внутренние проекты, продукты и сервисы в контексте технологических возможностей."
      layers={["Проекты", "Продукты", "Сервисы", "Связанные сценарии"]}
    />
  );
}
