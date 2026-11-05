import { scenarioAnalytics } from "@/server/analytics";
import { originalDirections, demoId } from "@/domain/ctv-reference";
import { CubePrototype } from "@/features/cube/cube-prototype";
export const dynamic = "force-dynamic";
export const metadata = { title: "Куб сценариев · Эксперимент" };
export default async function CubePage() {
  const data = await scenarioAnalytics({ q: "SYN-" });
  const directions = originalDirections.map((name, i) => ({
    id: demoId(`direction:${i}`),
    name,
  }));
  return (
    <CubePrototype
      data={{ ...data, rows: data.rows.slice(0, 160), directions }}
    />
  );
}
