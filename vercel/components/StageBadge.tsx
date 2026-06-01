import { STO_STAGE_COLORS } from "@/lib/types/sto";

export function StageBadge({
  stage,
  compact = false,
}: {
  stage?: string;
  compact?: boolean;
}) {
  const colors = (stage && STO_STAGE_COLORS[stage]) || {
    bg: "#73737333",
    fg: "#737373",
  };

  return (
    <span
      className={`sto-stage-badge${compact ? " sto-stage-badge-compact" : ""}`}
      style={{ background: colors.bg, color: colors.fg }}
    >
      {stage ?? "Unknown"}
    </span>
  );
}
