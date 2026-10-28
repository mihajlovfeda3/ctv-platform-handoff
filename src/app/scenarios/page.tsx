import { redirect } from "next/navigation";
export default async function Scenarios({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    if (typeof value === "string") params.set(key, value);
  redirect(`/scenarios/radar${params.size ? `?${params}` : ""}`);
}
