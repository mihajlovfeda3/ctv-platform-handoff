import { z } from "zod";
import { getScenario, relatedObjects } from "@/server/scenarios";
import { apiError } from "@/server/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id);
    if (!(await getScenario(id)))
      return Response.json({ error: "Сценарий не найден" }, { status: 404 });
    return Response.json(await relatedObjects(id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
