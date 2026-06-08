import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {
  output: "standalone",
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
