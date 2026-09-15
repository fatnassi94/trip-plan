// Where a page may send a traveler after sign-in, given a `?next=` value
// that anyone can put in a link. Only same-origin, path-absolute targets
// are allowed — otherwise /unlock?next=https://evil.example becomes a
// phishing redirect wearing RoamAI's login page (an "open redirect").
export function safeRedirectPath(value: string | null | undefined, fallback = "/account"): string {
  if (!value) return fallback;

  // "//host" and "/\host" are protocol-relative to browsers; any
  // backslash or control character is a normalization trick.
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if ([...value].some((ch) => ch.charCodeAt(0) < 32)) return fallback;

  const base = "http://roamai.invalid";
  try {
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
