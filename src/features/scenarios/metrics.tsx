export function Metrics({
  assessments,
}: {
  assessments: { metric: string; value: number | null }[];
}) {
  return (
    <div className="scenario-metrics">
      {[
        ["market_maturity", "Рыночная зрелость", 5],
        ["organizational_readiness", "Орг. готовность", 7],
        ["business_impact", "Влияние", 3],
      ].map(([key, label, max]) => (
        <div key={key}>
          <strong>
            {assessments.find((a) => a.metric === key)?.value ?? "—"}
            <small> / {max}</small>
          </strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
