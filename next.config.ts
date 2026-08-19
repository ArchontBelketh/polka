import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

// Content-Security-Policy in Report-Only first: it logs violations without
// breaking anything, so the policy can be tightened safely before enforcing.
// Allows Next.js inline/eval, Telegram Login Widget, S3 images and Sentry.
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://oauth.telegram.org",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' https://*.ingest.sentry.io",
  "frame-src https://oauth.telegram.org https://securepay.tinkoff.ru",
  "frame-ancestors 'none'",
].join("; ")

// Security headers applied to every response (also set at nginx in prod;
// duplicating here protects non-nginx deployments and local runs).
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
]

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  silent: true,
  // Only upload source maps when SENTRY_AUTH_TOKEN is set (CI/CD)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Disable source map upload in local builds
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
})
