/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The e2e suite (playwright.config.ts) builds into its own folder so it
  // never clobbers — or gets clobbered by — a `next dev` running in .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // Pages like /account render differently for signed-in and signed-out
    // visitors. By default Next 14 reuses a dynamic page's last payload in
    // the browser for 30s, so logging in and then opening "My account"
    // showed the cached signed-out page again (tests/e2e/auth.spec.ts).
    // 0 = always fetch the page fresh on navigation.
    staleTimes: { dynamic: 0 },
  },
  eslint: {
    // Runs explicitly via `npm run lint` (and should also run in CI) —
    // not worth re-running on every production build while the app is young.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
