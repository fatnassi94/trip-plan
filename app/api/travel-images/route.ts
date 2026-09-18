import { NextResponse } from "next/server";
import { z } from "zod";
import { getTravelImages } from "@/lib/travel-images";
import { imageRateLimiter } from "@/lib/rate-limit";

// Destination photography for client components (the gallery, the search
// results). Server-side only: the Unsplash key never leaves this process,
// and results are cached here as well as in lib/travel-images.

const QuerySchema = z.object({
  query: z.string().trim().min(2).max(80),
  count: z.coerce.number().int().min(1).max(12).optional(),
  orientation: z.enum(["landscape", "portrait", "squarish"]).optional(),
});

/** A day: destination photos don't change hour to hour. */
export const revalidate = 86400;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    query: url.searchParams.get("query") ?? "",
    count: url.searchParams.get("count") ?? undefined,
    orientation: url.searchParams.get("orientation") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid image request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const limit = imageRateLimiter.check(clientKey(req));
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many image requests — try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const result = await getTravelImages(parsed.data.query, {
    count: parsed.data.count,
    orientation: parsed.data.orientation,
  });

  return NextResponse.json(
    { images: result.images, source: result.source, degraded: result.degraded },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}

function clientKey(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
