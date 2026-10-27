const rules = new Intl.PluralRules("ru");
export function scenarioNoun(count: number) {
  const category = rules.select(count);
  return category === "one"
    ? "сценарий"
    : category === "few"
      ? "сценария"
      : "сценариев";
}
