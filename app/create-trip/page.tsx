// 02 — Create Trip. Destination, dates, travelers — nothing else on this
// screen. Preferences live on /profile, one step later, so this stays fast.
// A plain GET form so this can stay a Server Component: the fields arrive
// at /profile as query params.
function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function CreateTripPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <h1 className="font-display text-3xl font-semibold">Where are you going?</h1>
      <form className="mt-10 flex flex-col gap-6" action="/profile" method="get">
        <label className="flex flex-col gap-2 text-sm">
          Destination
          <input
            name="destination"
            required
            defaultValue="Paris, France"
            placeholder="Paris, France"
            className="rounded-md border border-border bg-transparent px-4 py-3 outline-none focus:border-accent"
          />
        </label>
        <div className="flex flex-col gap-4 sm:flex-row">
          <label className="flex flex-1 flex-col gap-2 text-sm">
            From
            <input
              type="date"
              name="startDate"
              required
              defaultValue={isoDaysFromNow(30)}
              className="rounded-md border border-border bg-transparent px-4 py-3 outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-1 flex-col gap-2 text-sm">
            To
            <input
              type="date"
              name="endDate"
              required
              defaultValue={isoDaysFromNow(34)}
              className="rounded-md border border-border bg-transparent px-4 py-3 outline-none focus:border-accent"
            />
          </label>
        </div>
        <label className="flex flex-col gap-2 text-sm">
          Who is traveling?
          <input
            type="number"
            name="travelers"
            min={1}
            max={20}
            defaultValue={2}
            className="rounded-md border border-border bg-transparent px-4 py-3 outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          className="mt-4 w-full rounded-md bg-accent px-6 py-3 font-medium text-paper hover:opacity-90 sm:w-auto"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
