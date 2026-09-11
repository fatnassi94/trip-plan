/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Runs explicitly via `npm run lint` (and should also run in CI) —
    // not worth re-running on every production build while the app is young.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
