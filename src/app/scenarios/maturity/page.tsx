import { Workspace } from "@/features/scenarios/workspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Матрица зрелости" };
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <Workspace view="maturity" {...props} />;
}
