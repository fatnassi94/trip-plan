import { NextResponse } from "next/server";
import { z } from "zod";
import { featuredDestinations } from "@/lib/destination-catalog";
import { toDestinationSummary } from "@/lib/destination-summary";

// Featured destinations for any client that wants them without importing
// the whole catalog (the home page renders its own on the server).

const QuerySchema = z.object({ count: z.coerce.number().int().min(1).max(12).optional() });

export const revalidate = 3600;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ count: url.searchParams.get("count") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const destinations = featuredDestinations(parsed.data.count ?? 6).map(toDestinationSummary);
  return NextResponse.json(
    { destinations },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
