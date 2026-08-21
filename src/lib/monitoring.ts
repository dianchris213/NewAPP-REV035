/**
 * Production error reporting (Sentry).
 *
 * Initialised lazily in the browser only, and only when VITE_SENTRY_DSN is
 * configured — development and preview runs stay completely untouched.
 */
import type { ErrorEvent, EventHint } from "@sentry/react";

const DSN = import.meta.env["VITE_SENTRY_DSN"] as string | undefined;
const ENVIRONMENT =
  (import.meta.env["VITE_SENTRY_ENV"] as string | undefined) ?? import.meta.env.MODE;
const RELEASE = import.meta.env["VITE_APP_RELEASE"] as string | undefined;

let started = false;

/** Strip anything that could contain user financial data before it leaves the device. */
function scrub(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  if (event.request?.cookies) delete event.request.cookies;
  if (event.user) event.user = event.user.id === undefined ? {} : { id: event.user.id };
  return event;
}

export async function initMonitoring() {
  if (started || typeof window === "undefined" || !DSN) return;
  started = true;
  const Sentry = await import("@sentry/react");
  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT,
    ...(RELEASE ? { release: RELEASE } : {}),
    // Crashes + unhandled rejections + failed fetch/XHR (API errors).
    integrations: [Sentry.browserTracingIntegration(), Sentry.httpClientIntegration()],
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: scrub,
  });
}

/** Report a handled error (API failure, boundary catch) to Sentry when enabled. */
export async function captureMonitoringError(
  error: unknown,
  context: Record<string, unknown> = {},
) {
  if (typeof window === "undefined" || !DSN) return;
  await initMonitoring();
  const Sentry = await import("@sentry/react");
  Sentry.captureException(error, { extra: context });
}

export type ApiSeverity = "warning" | "error" | "fatal";

/**
 * Severity routing for API failures — Sentry alert rules can filter on
 * `level` and on the `api.severity` tag:
 *  - 4xx client/validation issues → warning (digest only)
 *  - 5xx server issues           → error   (alert)
 *  - transport / unknown         → fatal   (page immediately)
 */
export function severityForStatus(status?: number): ApiSeverity {
  if (!status) return "fatal";
  if (status >= 500) return "error";
  if (status >= 400) return "warning";
  return "warning";
}

/**
 * Report an API failure as its own Sentry issue. The fingerprint keeps one
 * stable issue per operation + status instead of thousands of duplicates.
 */
export async function captureApiError(
  error: unknown,
  meta: { operation: string; status?: number; context?: Record<string, unknown> },
) {
  const severity = severityForStatus(meta.status);
  if (typeof window === "undefined" || !DSN) return severity;
  await initMonitoring();
  const Sentry = await import("@sentry/react");
  Sentry.captureException(error, {
    level: severity,
    tags: {
      "api.operation": meta.operation,
      "api.status": String(meta.status ?? "unknown"),
      "api.severity": severity,
    },
    fingerprint: ["api", meta.operation, String(meta.status ?? "unknown")],
    extra: { ...meta.context },
  });
  return severity;
}
