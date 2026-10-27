import { z } from "zod";
import { getScenario } from "@/server/scenarios";
import { apiError } from "@/server/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id);
    const item = await getScenario(id);
    return item
      ? Response.json(item, { headers: { "Cache-Control": "no-store" } })
      : Response.json({ error: "Сценарий не найден" }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
