import { it, expect } from "vitest";
import {
  editFilter,
  filterErrors,
  workspaceQuery,
} from "../src/features/scenarios/filter-state";
it.each(["maturity", "readiness", "impact"])(
  "normalizes exact/range symmetrically for %s",
  (p) => {
    const exact = editFilter({ [`${p}Max`]: "4" }, p, "7");
    expect(exact[`${p}Max`]).toBe("");
    const range = editFilter(exact, `${p}Min`, "2");
    expect(range[p]).toBe("");
  },
);
it("handles contradictory deep links inline while retaining context", () => {
  const result = workspaceQuery({
    readinessMin: "6",
    readinessMax: "4",
    q: "abc",
    context: "lab",
  });
  expect(result?.query.context).toBe("lab");
  expect(result?.query.q).toBe("abc");
  expect(filterErrors(result!.invalidDraft!).readinessMax).toBeTruthy();
});
