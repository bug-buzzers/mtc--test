/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Arena previews use a dynamic *.e2b.app host; allow dev assets and HMR there.
  allowedDevOrigins: ['*.e2b.app', '127.0.0.1'],
  images: { unoptimized: true, remotePatterns: [{ protocol: 'https', hostname: 'mapleskhatauli.com' }] },
  experimental: { optimizePackageImports: ['@phosphor-icons/react', 'framer-motion'] },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'Content-Security-Policy', value: process.env.NODE_ENV === 'production' ? "frame-ancestors 'self'" : 'frame-ancestors *' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ] }];
  },
};
export default nextConfig;
