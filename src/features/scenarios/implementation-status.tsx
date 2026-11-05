import { implementationLabel } from "@/domain/scenario";

export function ImplementationStatus({ value }: { value: string }) {
  const confirmed = value === "yes" || value === "no";
  return (
    <span className={confirmed ? `status ${value}` : "muted"}>
      {confirmed && <i />}
      {implementationLabel(value)}
    </span>
  );
}
