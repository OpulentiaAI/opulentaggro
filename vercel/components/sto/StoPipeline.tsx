import { STO_STAGES } from "@/lib/types/sto";

export function StoPipeline({
  stages,
  currentStage,
  stageIndex,
}: {
  stages?: string[];
  currentStage?: string;
  stageIndex?: number;
}) {
  const pipeline = stages ?? [...STO_STAGES.filter((s) => !["Cancelled", "Dispute"].includes(s))];
  const current = currentStage ?? "Draft";
  const idx = stageIndex ?? pipeline.indexOf(current);

  return (
    <div className="sto-pipeline" role="list" aria-label="STO workflow stages">
      {pipeline.map((stage, i) => {
        let cls = "sto-pipeline-step";
        if (stage === "Dispute" && current === "Dispute") cls += " dispute current";
        else if (stage === current) cls += " current";
        else if (i < idx && current !== "Dispute") cls += " done";
        else if (current === "Completed" || current === "Three Way Matched") cls += " done";

        return (
          <div key={stage} className={cls} role="listitem">
            {stage}
          </div>
        );
      })}
    </div>
  );
}
