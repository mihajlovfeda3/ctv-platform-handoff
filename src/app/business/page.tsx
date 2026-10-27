import { SectionPlaceholder } from "@/components/section-placeholder";
export const metadata = { title: "Бизнес и задачи" };
export default function Business() {
  return (
    <SectionPlaceholder
      eyebrow="БИЗНЕС-КОНТЕКСТ"
      title="Бизнес и задачи"
      description="От бизнес-ландшафта и процессов — к формализованным классам задач."
      layers={[
        "Бизнес-направления",
        "Бизнес-процессы и этапы",
        "Классы задач",
        "Типы эффектов",
      ]}
    />
  );
}
