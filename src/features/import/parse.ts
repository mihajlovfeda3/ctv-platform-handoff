import { parse } from "csv-parse/sync";
import { z } from "zod";
import {
  scenarioInput,
  ratingLimits,
  type NumericMetric,
} from "@/domain/scenario";
import { importMapping, importOptions, type Diagnostic } from "./contract";
import { stableId } from "@/lib/identity";

export interface ImportAdapter {
  parse(content: string, delimiter: string): Record<string, unknown>[];
}
// XLSX can implement this adapter later, retaining cell type and number format.
const adapters: Record<"csv" | "json", ImportAdapter> = {
  csv: {
    parse: (content, delimiter) => {
      const records: unknown[][] = parse(content, {
        bom: true,
        delimiter,
        skip_empty_lines: true,
        max_record_size: 100000,
      });
      if (!records.length) return [];
      const [headers, ...data] = records;
      if (
        headers.some((h) => typeof h !== "string" || !h.trim()) ||
        new Set(headers).size !== headers.length
      )
        throw new Error("Заголовки CSV должны быть непустыми и уникальными");
      return data.map((row) =>
        Object.fromEntries(headers.map((h, i) => [String(h), row[i]])),
      );
    },
  },
  json: {
    parse: (content) =>
      z
        .array(z.record(z.string(), z.unknown()))
        .max(10000)
        .parse(JSON.parse(content)),
  },
};
const textValue = (v: unknown) =>
  typeof v === "string"
    ? v.trim()
    : typeof v === "number" && Number.isFinite(v)
      ? String(v)
      : "";

export function prepareImport(
  content: string,
  format: "csv" | "json",
  rawMapping: unknown,
  rawOptions: unknown,
) {
  if (Buffer.byteLength(content, "utf8") > 10 * 1024 * 1024)
    throw new Error("Размер импорта превышает 10 МБ");
  const mapping = importMapping.parse(rawMapping),
    options = importOptions.parse(rawOptions);
  const rawRows = adapters[format].parse(content, mapping.delimiter);
  if (rawRows.length > 10000)
    throw new Error("Не более 10 000 строк за импорт");
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();
  const rows = rawRows.flatMap((raw, index) => {
    const row = index + 1;
    const issue = (
      field: string,
      severity: Diagnostic["severity"],
      message: string,
    ) => diagnostics.push({ row, field, severity, message });
    const read = (field: keyof typeof mapping.columns) => {
      const column = mapping.columns[field];
      if (!column) return undefined;
      if (!(column in raw))
        issue(field, "error", `Не найдена сопоставленная колонка «${column}»`);
      return raw[column];
    };
    const resolve = (
      field: "functionalGroupId" | "businessNodeId",
      v: unknown,
    ) => {
      const value = textValue(v);
      if (!value) return null;
      const mapped = mapping.references[field]?.[value] ?? value;
      if (!z.uuid().safeParse(mapped).success) {
        issue(
          field,
          "error",
          "Укажите UUID или явное сопоставление со справочником",
        );
        return null;
      }
      return mapped;
    };
    const externalId = textValue(read("externalId"));
    if (seen.has(externalId))
      issue("externalId", "error", "Повтор исходного ID внутри файла");
    seen.add(externalId);
    const ratings: Partial<Record<NumericMetric, number>> = {};
    for (const [metric, max] of Object.entries(ratingLimits) as [
      NumericMetric,
      number,
    ][]) {
      const value = read(metric);
      if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "")
      )
        continue;
      // Accept only explicit integer cells. Dates, serials and ranges remain unknown.
      if (
        (typeof value === "number" &&
          Number.isInteger(value) &&
          value >= 1 &&
          value <= max) ||
        (typeof value === "string" &&
          /^[1-9]$/.test(value.trim()) &&
          Number(value.trim()) <= max)
      )
        ratings[metric] = Number(value);
      else
        issue(
          metric,
          "warning",
          "Неоднозначная или недопустимая оценка: сохранена как неизвестная; исходное значение оставлено для проверки",
        );
    }
    const methodsRaw = read("technologyMethodIds");
    if (methodsRaw != null && typeof methodsRaw !== "string")
      issue(
        "technologyMethodIds",
        "error",
        "Ожидается строка ID через | с явным сопоставлением",
      );
    const methodIds = textValue(methodsRaw)
      .split("|")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => mapping.references.technologyMethodIds?.[v] ?? v);
    if (methodIds.some((id) => !z.uuid().safeParse(id).success))
      issue(
        "technologyMethodIds",
        "error",
        "Неизвестный метод: укажите UUID или явное сопоставление",
      );
    for (const field of [
      "algorithmText",
      "processText",
      "stageText",
      "tasksText",
    ] as const)
      if (textValue(read(field)))
        issue(
          field,
          "warning",
          "Текст сохранён в исходной строке для последующего сопоставления со справочником",
        );
    const implementationRaw = read("implementation");
    let implementation: "yes" | "no" | "unknown" = "unknown";
    if (implementationRaw != null && implementationRaw !== "") {
      if (["yes", "no", "unknown"].includes(String(implementationRaw)))
        implementation = implementationRaw as typeof implementation;
      else
        issue(
          "implementation",
          "warning",
          "Неизвестный статус реализации оставлен unknown",
        );
    }
    const data = scenarioInput.safeParse({
      id: stableId(
        `import-scenario:${JSON.stringify([options.namespace, externalId])}`,
      ),
      externalId,
      originNamespace: options.namespace,
      name: read("name"),
      description: read("description"),
      rationale: read("rationale") || null,
      functionalGroupId: resolve(
        "functionalGroupId",
        read("functionalGroupId"),
      ),
      businessNodeId: resolve("businessNodeId", read("businessNodeId")),
      businessChallenge: read("businessChallenge") || null,
      businessChallengeDescription:
        read("businessChallengeDescription") || null,
      businessEffect: read("businessEffect") || null,
      implementation,
      isSynthetic: options.synthetic,
      ooda: read("ooda") || null,
      technologyTrend: read("technologyTrend") || null,
      projectProposal: read("projectProposal") || null,
    });
    if (!data.success) {
      for (const error of data.error.issues)
        issue(error.path.join("."), "error", error.message);
      return [];
    }
    if (Object.keys(ratings).length && !options.assessedAt)
      issue(
        "assessedAt",
        "error",
        "Для оценок требуется явная дата assessedAt; дата импорта не считается датой оценки",
      );
    return [
      {
        row,
        raw,
        data: data.data,
        ratings,
        methodIds: [...new Set(methodIds)],
      },
    ];
  });
  return {
    rows,
    diagnostics,
    mapping,
    options,
    format,
    total: rawRows.length,
    valid: !diagnostics.some((d) => d.severity === "error"),
  };
}
export type PreparedImport = ReturnType<typeof prepareImport>;
