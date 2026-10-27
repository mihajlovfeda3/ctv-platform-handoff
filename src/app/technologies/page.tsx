import { SectionPlaceholder } from "@/components/section-placeholder";
export const metadata = { title: "Технологии и рынок" };
export default function Technologies() {
  return (
    <SectionPlaceholder
      eyebrow="ТЕХНОЛОГИЧЕСКИЙ КОНТЕКСТ"
      title="Технологии и рынок"
      description="Трёхуровневый справочник технологий и связанные рыночные объекты."
      layers={[
        "Направление → технология → метод",
        "Поставщики и решения",
        "Кейсы бенчмаркинга",
      ]}
    />
  );
}
