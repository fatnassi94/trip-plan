import { CreateTripForm } from "@/components/create-trip/create-trip-form";

// 02 — Create Trip. Destination, dates, travelers — nothing else on this
// screen. Preferences live on /profile, one step later, so this stays fast.
// The page itself stays a Server Component; only the interactive parts
// (destination autocomplete, date range picker) live in <CreateTripForm>.
export default function CreateTripPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <h1 className="font-display text-3xl font-semibold">Where are you going?</h1>
      <CreateTripForm />
    </main>
  );
}
