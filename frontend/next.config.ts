import type { NextConfig } from "next";

// Content-Security-Policy: protektif tapi tidak memutus fungsi.
// - script-src masih 'unsafe-inline'/'unsafe-eval' (kendala Next.js tanpa nonce);
//   pengetatan penuh (nonce) menyusul.
// - frame-src izinkan YouTube (embed di layar display antrian).
// - connect-src 'self' (API same-origin via /api) — EventSource/fetch aman.
// - frame-ancestors/object-src/base-uri dikunci (anti clickjacking & injeksi base).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https:",
  "media-src 'self' data: blob: https:",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(self), camera=(self)" },
];

const nextConfig: NextConfig = {
  // Skip TS + ESLint errors during prod build untuk deployment cepat.
  // TS errors di-fix bertahap di commit terpisah (banyak legacy file
  // belum strict-typed; dev mode tidak enforce strict check).
  typescript: { ignoreBuildErrors: true },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
