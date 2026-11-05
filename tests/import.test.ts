import { describe, expect, it } from "vitest";
import { prepareImport } from "../src/features/import/parse";
import { stableId } from "../src/lib/identity";
const mapping = {
  columns: {
    externalId: "id",
    name: "title",
    description: "description",
    application_trl: "trl",
    organizational_readiness: "og",
  },
};
const options = {
  namespace: "test-import",
  sourceName: "Синтетический тест",
  synthetic: true,
  context: "test",
  assessedAt: "2026-01-01T00:00:00Z",
};
const row = {
  id: "001",
  title: "Учебный сценарий",
  description: "Синтетическое описание",
  trl: null,
  og: null,
};
describe("Контракт импорта", () => {
  it.each(["csv", "json"] as const)(
    "проверяет статус реализации при импорте %s",
    (format) => {
      const statusMapping = {
        columns: {
          externalId: "id",
          name: "title",
          description: "description",
          implementation: "status",
        },
      };
      for (const status of [
        "yes",
        "no",
        "unknown",
        "unsupported",
        "",
        true,
        1,
        null,
      ]) {
        const content =
          format === "json"
            ? JSON.stringify([
                { id: "1", title: "Test", description: "Description", status },
              ])
            : `id,title,description,status\n1,Test,Description,${status ?? ""}\n`;
        const result = prepareImport(content, format, statusMapping, options);
        const missing = status === "" || status === null;
        expect(result.valid).toBe(
          status === "yes" || status === "no" || missing,
        );
        if (missing) {
          expect(result.rows[0].data.implementation).toBe("unknown");
          expect(result.diagnostics).toContainEqual(
            expect.objectContaining({
              field: "implementation",
              severity: "warning",
            }),
          );
        } else if (status !== "yes" && status !== "no") {
          expect(result.diagnostics).toContainEqual(
            expect.objectContaining({
              field: "implementation",
              severity: "error",
            }),
          );
        } else expect(result.rows[0].data.implementation).toBe(status);
      }
    },
  );
  it("принимает отдельные формулировки эффекта и описания вызова", () => {
    const result = prepareImport(
      JSON.stringify([
        {
          ...row,
          effect: "Сократить время сверки.",
          challenge: "Условия документов различаются.",
        },
      ]),
      "json",
      {
        columns: {
          ...mapping.columns,
          businessEffect: "effect",
          businessChallengeDescription: "challenge",
        },
      },
      options,
    );
    expect(result.valid).toBe(true);
    expect(result.rows[0].data).toMatchObject({
      businessEffect: "Сократить время сверки.",
      businessChallengeDescription: "Условия документов различаются.",
    });
  });
  it.each([
    45292,
    "01.01.2024",
    "3–5",
    "=2+3",
    "неизвестно",
    -1,
    10,
    2.5,
    true,
    { value: 4, format: "date" },
  ])("не считает неоднозначный TRL %j оценкой", (trl) => {
    const result = prepareImport(
      JSON.stringify([{ ...row, trl }]),
      "json",
      mapping,
      options,
    );
    expect(result.valid).toBe(true);
    expect(result.rows[0].ratings.application_trl).toBeUndefined();
    expect(result.rows[0].raw.trl).toEqual(trl);
    expect(result.diagnostics[0]).toMatchObject({
      field: "application_trl",
      severity: "warning",
    });
  });
  it("оставляет пустую готовность неизвестной и сохраняет исходный ID", () => {
    const result = prepareImport(
      "id,title,description,trl,og\n001,Сценарий,Описание,4,\n",
      "csv",
      mapping,
      options,
    );
    expect(result.valid).toBe(true);
    expect(result.rows[0].data.externalId).toBe("001");
    expect(result.rows[0].ratings).toEqual({ application_trl: 4 });
    expect(result.rows[0].data.implementation).toBe("unknown");
  });
  it("не подставляет готовность в TRL или рыночную зрелость", () => {
    const result = prepareImport(
      JSON.stringify([{ ...row, og: 6 }]),
      "json",
      mapping,
      options,
    );
    expect(result.rows[0].ratings).toEqual({ organizational_readiness: 6 });
  });
  it("требует явного сопоставления обязательных колонок", () =>
    expect(() =>
      prepareImport("[]", "json", { columns: { name: "title" } }, options),
    ).toThrow());
  it("отклоняет отсутствующую колонку и обязательный текст", () => {
    expect(
      prepareImport(
        JSON.stringify([{ ...row, title: "" }]),
        "json",
        mapping,
        options,
      ).valid,
    ).toBe(false);
    expect(
      prepareImport(
        JSON.stringify([{ id: "1", title: "Test", description: "D" }]),
        "json",
        mapping,
        options,
      ).valid,
    ).toBe(false);
  });
  it("отклоняет дубли исходных ID внутри файла", () =>
    expect(
      prepareImport(JSON.stringify([row, row]), "json", mapping, options).valid,
    ).toBe(false));
  it("отклоняет некорректные типы описания", () =>
    expect(
      prepareImport(
        JSON.stringify([{ ...row, description: 123 }]),
        "json",
        mapping,
        options,
      ).valid,
    ).toBe(false));
  it("не использует дату импорта как дату оценки", () =>
    expect(
      prepareImport(JSON.stringify([{ ...row, trl: 4 }]), "json", mapping, {
        ...options,
        assessedAt: undefined,
      }).valid,
    ).toBe(false));
  it("явно сопоставляет текстовые ссылки со справочниками", () => {
    const result = prepareImport(
      JSON.stringify([{ ...row, group: "Учебная группа" }]),
      "json",
      {
        columns: { ...mapping.columns, functionalGroupId: "group" },
        references: {
          functionalGroupId: { "Учебная группа": stableId("group") },
        },
      },
      options,
    );
    expect(result.valid).toBe(true);
    expect(result.rows[0].data.functionalGroupId).toBe(stableId("group"));
  });
  it("проверяет уникальность заголовков CSV и структуру JSON", () => {
    expect(() =>
      prepareImport("id,id,title\n1,2,3", "csv", mapping, options),
    ).toThrow();
    expect(() => prepareImport("{}", "json", mapping, options)).toThrow();
    expect(() => prepareImport("not-json", "json", mapping, options)).toThrow();
  });
  it("сохраняет кавычки и переносы в CSV", () => {
    const result = prepareImport(
      'id,title,description,trl,og\n001,"Название, с запятой","Строка 1\nСтрока 2",4,3',
      "csv",
      mapping,
      options,
    );
    expect(result.rows[0].data.description).toBe("Строка 1\nСтрока 2");
  });
  it("исключает коллизии пары namespace и внешнего ID с двоеточиями", () => {
    const first = prepareImport(
      JSON.stringify([{ ...row, id: "b:c" }]),
      "json",
      mapping,
      { ...options, namespace: "a" },
    );
    const second = prepareImport(
      JSON.stringify([{ ...row, id: "c" }]),
      "json",
      mapping,
      { ...options, namespace: "a:b" },
    );
    expect(first.rows[0].data.id).not.toBe(second.rows[0].data.id);
  });
});
