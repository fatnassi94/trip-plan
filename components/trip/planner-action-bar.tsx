// The sticky bottom bar from the design system's onboarding screens: the
// way back on the left, the one primary action on the right, always in
// reach no matter how far the traveler has scrolled. Pages using it must
// leave room at the bottom (pb-32) so the bar never covers content.
export function PlannerActionBar({
  start,
  end,
}: {
  start?: React.ReactNode;
  end: React.ReactNode;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-paper/90 shadow-float backdrop-blur-xl">
      <div className="mx-auto flex min-h-[4.5rem] max-w-[1440px] items-center justify-between gap-3 px-5 py-3 lg:px-12">
        <div className="flex min-w-0 items-center gap-2">{start}</div>
        <div className="flex shrink-0 items-center gap-4">{end}</div>
      </div>
    </div>
  );
}
