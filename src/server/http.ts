import { NextResponse } from "next/server";
import { ZodError } from "zod";
export function apiError(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: "Некорректные параметры", issues: error.issues },
      { status: 400 },
    );
  // Do not expose SQL, connection strings or imported content in HTTP responses/logs.
  console.error(
    "CTV request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return NextResponse.json(
    { error: "Не удалось получить данные. Проверьте подключение к базе." },
    { status: 503 },
  );
}
