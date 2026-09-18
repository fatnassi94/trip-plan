import { BatteryLow, BatteryMedium, BatteryFull } from "lucide-react";
import { describeEnergyLevel, type DayEnergy } from "@/lib/energy";

// How tiring a day is, at a glance (lib/energy.ts). Always worded as an
// estimate — it's arithmetic over durations, distances and stop types,
// not a measurement.
const STYLE = {
  light: { icon: BatteryFull, className: "bg-sage/20 text-accent" },
  steady: { icon: BatteryMedium, className: "bg-accent-soft text-accent" },
  heavy: { icon: BatteryLow, className: "bg-warm-soft text-warm" },
} as const;

export function EnergyBadge({
  energy,
  className = "",
}: {
  energy: DayEnergy;
  className?: string;
}) {
  const { label, hint } = describeEnergyLevel(energy.level);
  const style = STYLE[energy.level];

  return (
    <span
      title={`${hint} Estimated effort: ${energy.percent}% of a full day at your pace.`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-xs font-semibold ${style.className} ${className}`}
    >
      <style.icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
      <span className="font-mono text-[0.65rem] font-bold opacity-70">{energy.percent}%</span>
      <span className="sr-only">
        estimated effort, {energy.percent}% of a full day at your pace
      </span>
    </span>
  );
}
