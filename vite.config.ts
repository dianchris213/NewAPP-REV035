// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { sentryVitePlugin } from "@sentry/vite-plugin";

/**
 * Sentry source map upload.
 *
 * Production builds always emit source maps so API/runtime stack traces can be
 * symbolicated. Upload only happens when SENTRY_AUTH_TOKEN / SENTRY_ORG /
 * SENTRY_PROJECT are present (CI + release builds); local and preview builds
 * stay untouched. `filesToDeleteAfterUpload` keeps the maps out of the shipped
 * bundle so no source is exposed publicly.
 */
const sentryAuthToken = process.env["SENTRY_AUTH_TOKEN"];
const sentryOrg = process.env["SENTRY_ORG"];
const sentryProject = process.env["SENTRY_PROJECT"];

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  plugins:
    sentryAuthToken && sentryOrg && sentryProject
      ? [
          sentryVitePlugin({
            authToken: sentryAuthToken,
            org: sentryOrg,
            project: sentryProject,
            telemetry: false,
            ...(process.env["VITE_APP_RELEASE"]
              ? { release: { name: process.env["VITE_APP_RELEASE"] } }
              : {}),
            sourcemaps: {
              filesToDeleteAfterUpload: ["**/*.map"],
            },
          }),
        ]
      : [],

  vite: {
    build: {
      // "hidden" = emit maps for Sentry, but no sourceMappingURL comment in the
      // shipped assets.
      sourcemap: "hidden",
    },
  },
});
