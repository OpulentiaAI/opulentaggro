import { Suspense } from "react";
import { STO_STAGES } from "@/lib/types/sto";

export function StageSummaryCards({
  summary,
}: {
  summary: Record<string, number>;
}) {
  const stages = STO_STAGES.filter((stage) => (summary[stage] ?? 0) > 0);

  if (!stages.length) {
    return null;
  }

  return (
    <div className="summary-grid">
      {stages.map((stage) => (
        <div key={stage} className="summary-card">
          <div className="count">{summary[stage] ?? 0}</div>
          <div className="label">{stage}</div>
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="summary-grid" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="summary-card">
          <div className="count muted">…</div>
          <div className="label muted">Loading</div>
        </div>
      ))}
    </div>
  );
}

export function StoDashboardFallback() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardSkeleton />
    </Suspense>
  );
}
