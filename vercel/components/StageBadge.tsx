import { STO_STAGE_COLORS } from "@/lib/types/sto";

export function StageBadge({ stage }: { stage?: string }) {
  const colors = (stage && STO_STAGE_COLORS[stage]) || {
    bg: "#73737333",
    fg: "#737373",
  };

  return (
    <span
      className="stage-badge"
      style={{ background: colors.bg, color: colors.fg }}
    >
      {stage ?? "Unknown"}
    </span>
  );
}
