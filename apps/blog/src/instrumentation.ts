/**
 * OpenTelemetry → PostHog: distributed traces and structured logs.
 *
 * Next.js 15+ runs this automatically at server startup; no config hook needed.
 *
 * Why this app and not the docs sites: this is the only property with real
 * server-side work. `/go/<key>` is `force-dynamic`, reads Supabase, resolves a
 * destination, and 302s — and it produced 18,050 `short_link_click` events from
 * a single distinct_id before stopping dead on 2026-08-10. Traces and logs are
 * how that gets explained rather than guessed at. Statically-rendered docs pages
 * would produce volume without signal, and Logs bills by GB.
 *
 * Auth is the PUBLIC project token (`phc_`), passed as a query param — the same
 * write-only key the browser already ships. Personal API keys (`phx_`) are
 * explicitly wrong here and must never appear in this file.
 *
 * Silent no-op without a token, so local `next dev`, forks, and preview builds
 * behave exactly as they do today.
 */
import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const HOST = 'https://us.i.posthog.com';
const SERVICE_NAME = 'blog';

/**
 * Read at RUNTIME, not build time. `NEXT_PUBLIC_*` is inlined into the browser
 * bundle, but a server module needs the deployed runtime value — and that value
 * has been an empty string on this project before, which is why `||` is used
 * rather than `??`: "declared but blank" must count as absent. Same reasoning
 * and same fallback as the `/go` route handler.
 */
function projectToken(): string | null {
  const token =
    process.env.POSTHOG_PROJECT_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
    null;
  return token;
}

/**
 * Exported so route handlers can flush before the response is returned.
 * Vercel functions can finish a request before a batch processor has sent
 * anything, which silently loses the spans that matter most — the ones from
 * short-lived route handlers.
 */
export let tracerProvider: NodeTracerProvider | undefined;
export let loggerProvider: LoggerProvider | undefined;

export function register(): void {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const token = projectToken();
  if (!token) return;

  const resource = resourceFromAttributes({ [ATTR_SERVICE_NAME]: SERVICE_NAME });

  tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: `${HOST}/i/v1/traces?token=${token}` }),
      ),
    ],
  });
  tracerProvider.register();

  loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor(
        new OTLPLogExporter({ url: `${HOST}/i/v1/logs?token=${token}` }),
      ),
    ],
  });
  logs.setGlobalLoggerProvider(loggerProvider);
}

/**
 * Flush both pipelines. Call from `after()` in a route handler that emits spans
 * or logs worth keeping. Never throws: telemetry must not be able to fail a
 * request.
 */
export async function flushTelemetry(): Promise<void> {
  try {
    await Promise.all([
      tracerProvider?.forceFlush() ?? Promise.resolve(),
      loggerProvider?.forceFlush() ?? Promise.resolve(),
    ]);
  } catch {
    // Telemetry is never allowed to break the request path.
  }
}
