import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

// Security headers applied to every response (also set at nginx in prod;
// duplicating here protects non-nginx deployments and local runs).
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
